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

# Execute your actual queries
@app.route('/api/query/1')
def query1_revenue_per_hotel():
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database not connected", "sample": True, "data": [
            {"name": "Grand Plaza", "total_revenue": 45200.00},
            {"name": "Ocean View", "total_revenue": 38900.00},
            {"name": "Mountain Lodge", "total_revenue": 27600.00}
        ]})
    
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
        return jsonify({"error": "Database not connected", "sample": True, "data": [
            {"full_name": "John Smith"},
            {"full_name": "Emma Wilson"},
            {"full_name": "Michael Brown"}
        ]})
    
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
    # Get dates from query params or use defaults
    hotel_id = request.args.get('hotel_id', 101)
    check_in = request.args.get('check_in', '2025-04-20')
    check_out = request.args.get('check_out', '2025-05-01')
    
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database not connected", "sample": True, "data": [
            {"room_number": 201, "price": 250.00, "capacity": "Double"},
            {"room_number": 305, "price": 450.00, "capacity": "Suite"},
            {"room_number": 108, "price": 180.00, "capacity": "Single"}
        ]})
    
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
        return jsonify({"error": "Database not connected", "sample": True, "data": [
            {"name": "Luxury Hotels International", "hotel_count": 12}
        ]})
    
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

# Get statistics for dashboard
@app.route('/api/stats')
def get_stats():
    conn = get_db_connection()
    if not conn:
        return jsonify({
            "total_hotels": 25,
            "total_customers": 189,
            "total_revenue": 168000,
            "total_bookings": 456,
            "avg_room_price": 275
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

# Get hotels list for dropdown
@app.route('/api/hotels')
def get_hotels():
    conn = get_db_connection()
    if not conn:
        return jsonify([{"id": 101, "name": "Grand Plaza Hotel"}, {"id": 102, "name": "Ocean View Resort"}])
    
    try:
        cur = conn.cursor()
        cur.execute("SELECT Hotel_ID, Name FROM HOTEL ORDER BY Name")
        results = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)})

# Serve frontend
@app.route('/')
def serve_frontend():
    return send_from_directory('../frontend', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('../frontend', path)

if __name__ == '__main__':
    app.run(debug=True, port=5000)