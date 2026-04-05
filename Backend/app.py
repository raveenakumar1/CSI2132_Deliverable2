from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import psycopg2
import psycopg2.extras
import os
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

app = Flask(__name__, static_folder='../frontend')
CORS(app)

# Database connection
def get_db_connection():
    try:
        conn = psycopg2.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            database=os.getenv('DB_NAME'),
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD'),
            port=os.getenv('DB_PORT', '5432'),
            cursor_factory=psycopg2.extras.RealDictCursor
        )
        return conn
    except Exception as e:
        print(f"Database connection error: {e}")
        return None

# Health check
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok"})

# ==================== ROOM SEARCH WITH ALL CRITERIA ====================
@app.route('/api/rooms/search', methods=['GET'])
def search_rooms():
    check_in = request.args.get('check_in')
    check_out = request.args.get('check_out')
    capacity = request.args.get('capacity')
    area = request.args.get('area')
    chain_id = request.args.get('chain_id')
    category = request.args.get('category')
    min_price = request.args.get('min_price', 0)
    max_price = request.args.get('max_price', 9999)
    
    conn = get_db_connection()
    if not conn:
        return jsonify([])
    
    try:
        cur = conn.cursor()
        query = """
            SELECT r.Room_number, r.Price, r.Capacity, r.View_type, 
                   h.Name as hotel_name, h.Hotel_id
            FROM ROOM r
            JOIN HOTEL h ON r.Hotel_ID = h.Hotel_ID
            WHERE r.Price BETWEEN %s AND %s
        """
        params = [min_price, max_price]
        
        if capacity and capacity != '':
            query += " AND r.Capacity = %s"
            params.append(capacity)
        
        if chain_id and chain_id != '':
            query += " AND h.Chain_ID = %s"
            params.append(chain_id)
        
        if category and category != '':
            query += " AND h.Category = %s"
            params.append(category)
        
        if area and area != '':
            query += " AND h.Address LIKE %s"
            params.append(f'%{area}%')
        
        if check_in and check_out:
            query += """ AND NOT EXISTS (
                SELECT 1 FROM BOOKING b
                WHERE b.Room_number = r.Room_number
                AND b.Hotel_ID = r.Hotel_ID
                AND b.Status != 'Cancelled'
                AND b.Check_in_date < %s
                AND b.Check_out_date > %s
            )"""
            params.append(check_out)
            params.append(check_in)
        
        cur.execute(query, params)
        results = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify([dict(row) for row in results])
    except Exception as e:
        print(f"Search error: {e}")
        return jsonify([])

# ==================== FILTERS ====================
@app.route('/api/areas', methods=['GET'])
def get_areas():
    conn = get_db_connection()
    if not conn:
        return jsonify([{"area": "Downtown"}, {"area": "Beach"}, {"area": "Airport"}])
    
    try:
        cur = conn.cursor()
        cur.execute("SELECT DISTINCT TRIM(SPLIT_PART(Address, ',', 2)) as area FROM HOTEL WHERE SPLIT_PART(Address, ',', 2) != ''")
        results = cur.fetchall()
        cur.close()
        conn.close()
        if results:
            return jsonify([dict(row) for row in results])
        return jsonify([{"area": "Downtown"}, {"area": "Beach"}])
    except Exception as e:
        return jsonify([{"area": "Downtown"}, {"area": "Beach"}])

@app.route('/api/chains', methods=['GET'])
def get_chains():
    conn = get_db_connection()
    if not conn:
        return jsonify([{"chain_id": 1, "name": "Luxury Hotels"}, {"chain_id": 2, "name": "Budget Inns"}])
    
    try:
        cur = conn.cursor()
        cur.execute("SELECT Chain_ID, Name FROM HOTEL_CHAIN")
        results = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify([dict(row) for row in results])
    except Exception as e:
        return jsonify([])

# ==================== CUSTOMER ENDPOINTS ====================
@app.route('/api/customers', methods=['GET'])
def get_customers():
    conn = get_db_connection()
    if not conn:
        return jsonify([])
    
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM CUSTOMER ORDER BY Customer_ID")
        results = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify([dict(row) for row in results])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/customers', methods=['POST'])
def add_customer():
    data = request.json
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO CUSTOMER (Full_name, Address, ID_type, ID_value, Registration_date)
            VALUES (%s, %s, %s, %s, CURRENT_DATE)
            RETURNING Customer_ID
        """, (data['full_name'], data.get('address'), data.get('id_type'), data['id_value']))
        result = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"customer_id": result['customer_id']})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/customers/<int:customer_id>', methods=['DELETE'])
def delete_customer(customer_id):
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM CUSTOMER WHERE Customer_ID = %s", (customer_id,))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/customers/<int:customer_id>/bookings', methods=['GET'])
def get_customer_bookings(customer_id):
    conn = get_db_connection()
    if not conn:
        return jsonify([])
    
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT b.Booking_ID, b.Check_in_date, b.Check_out_date, b.Status,
                   r.Room_number, h.Name as hotel_name
            FROM BOOKING b
            JOIN ROOM r ON b.Room_number = r.Room_number AND b.Hotel_ID = r.Hotel_ID
            JOIN HOTEL h ON b.Hotel_ID = h.Hotel_ID
            WHERE b.Customer_ID = %s AND b.Status != 'Cancelled'
            ORDER BY b.Check_in_date
        """, (customer_id,))
        results = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify([dict(row) for row in results])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ==================== BOOKING ENDPOINTS ====================
@app.route('/api/bookings', methods=['POST'])
def create_booking():
    data = request.json
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO BOOKING (Customer_ID, Room_number, Hotel_ID, Check_in_date, Check_out_date, Status, Booking_date)
            VALUES (%s, %s, %s, %s, %s, 'Confirmed', CURRENT_DATE)
            RETURNING Booking_ID
        """, (data['customer_id'], data['room_number'], data['hotel_id'], data['check_in_date'], data['check_out_date']))
        result = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"booking_id": result['booking_id']})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/bookings/pending', methods=['GET'])
def get_pending_bookings():
    conn = get_db_connection()
    if not conn:
        return jsonify([])
    
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT b.Booking_ID, b.Check_in_date, b.Check_out_date, b.Status,
                   c.Full_name as customer_name, r.Room_number, h.Hotel_ID, h.Name as hotel_name,
                   b.Customer_ID
            FROM BOOKING b
            JOIN CUSTOMER c ON b.Customer_ID = c.Customer_ID
            JOIN ROOM r ON b.Room_number = r.Room_number AND b.Hotel_ID = r.Hotel_ID
            JOIN HOTEL h ON b.Hotel_ID = h.Hotel_ID
            WHERE b.Status = 'Confirmed' AND b.Check_in_date <= CURRENT_DATE
        """)
        results = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify([dict(row) for row in results])
    except Exception as e:
        return jsonify([])

# ==================== RENTING ENDPOINTS ====================
@app.route('/api/rentings/from-booking', methods=['POST'])
def convert_booking_to_renting():
    data = request.json
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    try:
        cur = conn.cursor()
        cur.execute("SELECT COALESCE(MAX(Renting_ID), 0) + 1 as new_id FROM RENTING")
        new_id = cur.fetchone()['new_id']
        
        cur.execute("""
            INSERT INTO RENTING (Renting_ID, Customer_ID, Room_number, Hotel_ID, Employee_ID,
                                 Check_in_date, Check_out_date, Amount_due, Status, Booking_ID)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'Confirmed', %s)
        """, (new_id, data['customer_id'], data['room_number'], data['hotel_id'], data['employee_id'],
              data['check_in_date'], data['check_out_date'], data['amount_due'], data['booking_id']))
        
        cur.execute("UPDATE BOOKING SET Status = 'Completed' WHERE Booking_ID = %s", (data['booking_id'],))
        
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"renting_id": new_id})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/rentings/direct', methods=['POST'])
def create_direct_renting():
    data = request.json
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    try:
        cur = conn.cursor()
        cur.execute("SELECT COALESCE(MAX(Renting_ID), 0) + 1 as new_id FROM RENTING")
        new_id = cur.fetchone()['new_id']
        
        cur.execute("""
            INSERT INTO RENTING (Renting_ID, Customer_ID, Room_number, Hotel_ID, Employee_ID,
                                 Check_in_date, Check_out_date, Amount_due, Status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'Confirmed')
        """, (new_id, data['customer_id'], data['room_number'], data['hotel_id'], data['employee_id'],
              data['check_in_date'], data['check_out_date'], data['amount_due']))
        
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"renting_id": new_id})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ==================== PAYMENT ENDPOINTS ====================
@app.route('/api/payments', methods=['POST'])
def process_payment():
    data = request.json
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    try:
        cur = conn.cursor()
        cur.execute("""
            UPDATE RENTING 
            SET Amount_paid = %s, Payment_method = %s, Status = 'Completed'
            WHERE Renting_ID = %s
        """, (data['amount_paid'], data['payment_method'], data['renting_id']))
        
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ==================== EMPLOYEE ENDPOINTS ====================
@app.route('/api/employees', methods=['GET'])
def get_employees():
    conn = get_db_connection()
    if not conn:
        return jsonify([])
    
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM EMPLOYEE")
        results = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify([dict(row) for row in results])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/employees', methods=['POST'])
def add_employee():
    data = request.json
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    try:
        cur = conn.cursor()
        cur.execute("SELECT COALESCE(MAX(Employee_ID), 0) + 1 as new_id FROM EMPLOYEE")
        new_id = cur.fetchone()['new_id']
        
        cur.execute("""
            INSERT INTO EMPLOYEE (Employee_ID, Full_name, Address, SSN_SIN, Role, Hotel_ID)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (new_id, data['full_name'], data.get('address'), data['ssn_sin'], data['role'], data['hotel_id']))
        
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"employee_id": new_id})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/employees/<int:employee_id>', methods=['DELETE'])
def delete_employee(employee_id):
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM EMPLOYEE WHERE Employee_ID = %s", (employee_id,))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ==================== HOTEL ENDPOINTS ====================
@app.route('/api/hotels/all', methods=['GET'])
def get_all_hotels():
    conn = get_db_connection()
    if not conn:
        return jsonify([])
    
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT h.*, COUNT(r.Room_number) as number_of_rooms
            FROM HOTEL h
            LEFT JOIN ROOM r ON h.Hotel_ID = r.Hotel_ID
            GROUP BY h.Hotel_ID
        """)
        results = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify([dict(row) for row in results])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/hotels', methods=['POST'])
def add_hotel():
    data = request.json
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO HOTEL (Hotel_ID, Name, Address, Category, Email, Phone_number, Chain_ID)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (data['hotel_id'], data['name'], data['address'], data['category'], 
              data.get('email'), data.get('phone_number'), data['chain_id']))
        
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/hotels/<int:hotel_id>', methods=['DELETE'])
def delete_hotel(hotel_id):
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM HOTEL WHERE Hotel_ID = %s", (hotel_id,))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ==================== ROOM ENDPOINTS ====================
@app.route('/api/rooms/all', methods=['GET'])
def get_all_rooms():
    conn = get_db_connection()
    if not conn:
        return jsonify([])
    
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT r.*, h.Name as hotel_name
            FROM ROOM r
            JOIN HOTEL h ON r.Hotel_ID = h.Hotel_ID
        """)
        results = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify([dict(row) for row in results])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/rooms', methods=['POST'])
def add_room():
    data = request.json
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO ROOM (Room_number, Hotel_ID, Price, Capacity, View_type, Can_extend)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (data['room_number'], data['hotel_id'], data['price'], 
              data['capacity'], data.get('view_type'), data.get('can_extend', False)))
        
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/rooms/<int:room_number>/<int:hotel_id>', methods=['DELETE'])
def delete_room(room_number, hotel_id):
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM ROOM WHERE Room_number = %s AND Hotel_ID = %s", (room_number, hotel_id))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ==================== SQL VIEWS ====================
@app.route('/api/views/available-rooms-per-area', methods=['GET'])
def get_view1():
    conn = get_db_connection()
    if not conn:
        return jsonify([])
    
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT 
                TRIM(SPLIT_PART(h.Address, ',', 2)) AS Area,
                COUNT(r.Room_number) AS total_rooms,
                COUNT(r.Room_number) - COUNT(CASE WHEN b.Status NOT IN ('Cancelled', 'Completed') THEN 1 END) AS available_rooms
            FROM HOTEL h
            JOIN ROOM r ON h.Hotel_ID = r.Hotel_ID
            LEFT JOIN BOOKING b ON r.Room_number = b.Room_number AND r.Hotel_ID = b.Hotel_ID
            GROUP BY Area
        """)
        results = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify([dict(row) for row in results])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/views/hotel-total-capacity', methods=['GET'])
def get_view2():
    conn = get_db_connection()
    if not conn:
        return jsonify([])
    
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT 
                h.Hotel_ID,
                h.Name,
                SUM(CASE r.Capacity 
                    WHEN 'Single' THEN 1 
                    WHEN 'Double' THEN 2 
                    WHEN 'Triple' THEN 3 
                    WHEN 'Suite' THEN 4 
                    ELSE 1 END) AS total_capacity_guests
            FROM HOTEL h
            JOIN ROOM r ON h.Hotel_ID = r.Hotel_ID
            GROUP BY h.Hotel_ID, h.Name
        """)
        results = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify([dict(row) for row in results])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ==================== QUERY ENDPOINTS (Original) ====================
@app.route('/api/query/1')
def query1_revenue_per_hotel():
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database not connected"})
    
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT h.Name, SUM(r.Amount_due) AS Total_Revenue
            FROM HOTEL h
            JOIN RENTING r ON h.Hotel_ID = r.Hotel_ID
            GROUP BY h.Hotel_ID, h.Name
            ORDER BY Total_Revenue DESC
        """)
        results = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)})

@app.route('/api/query/2')
def query2_customers_above_avg():
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database not connected"})
    
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT DISTINCT c.Full_name
            FROM CUSTOMER c
            JOIN BOOKING b ON c.Customer_ID = b.Customer_ID
            JOIN ROOM r ON b.Room_number = r.Room_number AND b.Hotel_ID = r.Hotel_ID
            WHERE r.Price > (SELECT AVG(Price) FROM ROOM)
            ORDER BY c.Full_name
        """)
        results = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)})

@app.route('/api/query/3')
def query3_available_rooms():
    hotel_id = request.args.get('hotel_id', 101)
    check_in = request.args.get('check_in', '2025-04-20')
    check_out = request.args.get('check_out', '2025-05-01')
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database not connected"})
    
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT r.Room_number, r.Price, r.Capacity
            FROM ROOM r
            WHERE r.Hotel_ID = %s
            AND NOT EXISTS (
                SELECT 1 FROM BOOKING b
                WHERE b.Room_number = r.Room_number
                AND b.Hotel_ID = r.Hotel_ID
                AND b.Status != 'Cancelled'
                AND b.Check_in_date < %s
                AND b.Check_out_date > %s
            )
            ORDER BY r.Price
        """, (hotel_id, check_out, check_in))
        results = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)})

@app.route('/api/query/4')
def query4_top_chain():
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database not connected"})
    
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT hc.Name, COUNT(h.Hotel_ID) AS Hotel_Count
            FROM HOTEL_CHAIN hc
            JOIN HOTEL h ON hc.Chain_ID = h.Chain_ID
            GROUP BY hc.Chain_ID, hc.Name
            ORDER BY Hotel_Count DESC
            LIMIT 1
        """)
        results = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)})

# ==================== STATISTICS ====================
@app.route('/api/stats')
def get_stats():
    conn = get_db_connection()
    if not conn:
        return jsonify({
            "total_hotels": 0,
            "total_customers": 0,
            "total_revenue": 0,
            "total_bookings": 0,
            "avg_room_price": 0
        })
    
    try:
        cur = conn.cursor()
        
        cur.execute("SELECT COUNT(*) as count FROM HOTEL")
        hotels = cur.fetchone()
        
        cur.execute("SELECT COUNT(*) as count FROM CUSTOMER")
        customers = cur.fetchone()
        
        cur.execute("SELECT COALESCE(SUM(Amount_due), 0) as total FROM RENTING WHERE Status = 'Completed'")
        revenue = cur.fetchone()
        
        cur.execute("SELECT COUNT(*) as count FROM BOOKING WHERE Status != 'Cancelled'")
        bookings = cur.fetchone()
        
        cur.execute("SELECT AVG(Price) as avg FROM ROOM")
        avg_price = cur.fetchone()
        
        cur.close()
        conn.close()
        
        return jsonify({
            "total_hotels": hotels['count'] if hotels else 0,
            "total_customers": customers['count'] if customers else 0,
            "total_revenue": float(revenue['total']) if revenue else 0,
            "total_bookings": bookings['count'] if bookings else 0,
            "avg_room_price": round(float(avg_price['avg']), 2) if avg_price and avg_price['avg'] else 0
        })
    except Exception as e:
        return jsonify({"error": str(e)})

@app.route('/api/hotels')
def get_hotels():
    conn = get_db_connection()
    if not conn:
        return jsonify([])
    
    try:
        cur = conn.cursor()
        cur.execute("SELECT Hotel_ID, Name FROM HOTEL ORDER BY Name")
        results = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify([dict(row) for row in results])
    except Exception as e:
        return jsonify({"error": str(e)})

# ==================== SERVE FRONTEND ====================
@app.route('/')
def serve_frontend():
    return send_from_directory('../frontend', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('../frontend', path)

if __name__ == '__main__':
    print("Starting Hotel Management System Backend...")
    print("Server running at http://localhost:5000")
    app.run(debug=True, port=5000)