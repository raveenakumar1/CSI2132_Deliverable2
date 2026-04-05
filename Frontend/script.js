const API_URL = 'http://localhost:5000/api';
let currentRole = 'customer';

document.addEventListener('DOMContentLoaded', () => {
    checkBackendConnection();
    loadFilters();
    searchRooms();
    setRole('customer');
});

async function checkBackendConnection() {
    try {
        const response = await fetch(`${API_URL}/health`);
        if (response.ok) {
            console.log('Backend connected');
        }
    } catch (error) {
        console.error('Backend not running:', error);
        const resultsDiv = document.getElementById('searchResults');
        if (resultsDiv) {
            resultsDiv.innerHTML = '<div class="message error">Cannot connect to backend server. Please run: python3 backend/app.py</div>';
        }
    }
}

function setRole(role) {
    currentRole = role;
    const banner = document.getElementById('modeBanner');
    
    if (role === 'customer') {
        banner.className = 'mode-banner customer-mode';
        banner.innerHTML = `
            <div class="mode-icon"></div>
            <div class="mode-text">
                <strong>CUSTOMER MODE</strong>
                You can search for rooms and make bookings
            </div>
            <div class="mode-switch">
                <button class="switch-btn" onclick="setRole('customer')">Customer</button>
                <button class="switch-btn" onclick="setRole('employee')">Employee</button>
            </div>
        `;
        document.getElementById('customerSection').style.display = 'block';
        document.getElementById('employeeSection').style.display = 'none';
        
        const customerId = document.getElementById('bookingCustomerId').value;
        if (customerId) {
            loadCustomerBookings();
        }
    } else {
        banner.className = 'mode-banner employee-mode';
        banner.innerHTML = `
            <div class="mode-icon"></div>
            <div class="mode-text">
                <strong>EMPLOYEE MODE</strong>
                You can manage bookings, rentings, payments, and hotel data
            </div>
            <div class="mode-switch">
                <button class="switch-btn" onclick="setRole('customer')">Customer</button>
                <button class="switch-btn" onclick="setRole('employee')">Employee</button>
            </div>
        `;
        document.getElementById('customerSection').style.display = 'none';
        document.getElementById('employeeSection').style.display = 'block';
        loadEmployeeData();
    }
}

async function loadFilters() {
    try {
        const areasRes = await fetch(`${API_URL}/areas`);
        if (areasRes.ok) {
            const areas = await areasRes.json();
            const areaSelect = document.getElementById('area');
            if (areaSelect) {
                areas.forEach(area => {
                    const option = document.createElement('option');
                    option.value = area.area;
                    option.textContent = area.area;
                    areaSelect.appendChild(option);
                });
            }
        }
        
        const chainsRes = await fetch(`${API_URL}/chains`);
        if (chainsRes.ok) {
            const chains = await chainsRes.json();
            const chainSelect = document.getElementById('chain');
            if (chainSelect) {
                chains.forEach(chain => {
                    const option = document.createElement('option');
                    option.value = chain.chain_id;
                    option.textContent = chain.name;
                    chainSelect.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Error loading filters:', error);
    }
}

async function searchRooms() {
    const checkIn = document.getElementById('checkIn').value;
    const checkOut = document.getElementById('checkOut').value;
    const capacity = document.getElementById('capacity').value;
    const area = document.getElementById('area').value;
    const chainId = document.getElementById('chain').value;
    const category = document.getElementById('category').value;
    const totalRooms = document.getElementById('totalRooms').value;
    const minPrice = document.getElementById('minPrice').value || 0;
    const maxPrice = document.getElementById('maxPrice').value || 9999;
    
    const params = new URLSearchParams({
        check_in: checkIn,
        check_out: checkOut,
        capacity: capacity,
        area: area,
        chain_id: chainId,
        category: category,
        total_rooms: totalRooms,
        min_price: minPrice,
        max_price: maxPrice
    });
    
    const resultsDiv = document.getElementById('searchResults');
    resultsDiv.innerHTML = '<div class="loading"><div class="spinner"></div><p>Searching available rooms...</p></div>';
    
    try {
        const response = await fetch(`${API_URL}/rooms/search?${params}`);
        
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }
        
        const rooms = await response.json();
        
        if (!rooms || rooms.length === 0) {
            resultsDiv.innerHTML = '<div class="message info">No rooms available for the selected criteria.</div>';
            document.getElementById('resultCount').textContent = '0 rooms found';
            return;
        }
        
        let html = '<div class="table-wrapper"><table><thead><tr>';
        html += '<th>Hotel</th><th>Room Number</th><th>Capacity</th><th>Price</th><th>View</th><th>Action</th>';
        html += '</tr></thead><tbody>';
        
        rooms.forEach(room => {
            html += `<tr>
                <td>${room.hotel_name || room.hotel_id}</td>
                <td>${room.room_number}</td>
                <td>${room.capacity}</td>
                <td>$${room.price}</td>
                <td>${room.view_type || 'N/A'}</td>
                <td>`;
            
            if (currentRole === 'customer') {
                html += `<button class="action-btn book" onclick="showBookingForm(${room.room_number}, ${room.hotel_id})">Book</button>`;
            } else {
                html += `<button class="action-btn rent" onclick="showDirectRentForm(${room.room_number}, ${room.hotel_id}, ${room.price})">Rent Now</button>`;
            }
            
            html += `</td></tr>`;
        });
        
        html += '</tbody></table></div>';
        resultsDiv.innerHTML = html;
        document.getElementById('resultCount').textContent = `${rooms.length} rooms found`;
        
    } catch (error) {
        console.error('Search error:', error);
        resultsDiv.innerHTML = `<div class="message error">Error searching rooms: ${error.message}</div>`;
        document.getElementById('resultCount').textContent = 'Error';
    }
}

function showBookingForm(roomNumber, hotelId) {
    document.getElementById('bookingRoomNumber').value = roomNumber;
    document.getElementById('bookingHotelId').value = hotelId;
    document.getElementById('bookingCheckIn').value = document.getElementById('checkIn').value;
    document.getElementById('bookingCheckOut').value = document.getElementById('checkOut').value;
    document.getElementById('bookingCustomerId').focus();
}

async function createBooking() {
    const booking = {
        customer_id: parseInt(document.getElementById('bookingCustomerId').value),
        room_number: parseInt(document.getElementById('bookingRoomNumber').value),
        hotel_id: parseInt(document.getElementById('bookingHotelId').value),
        check_in_date: document.getElementById('bookingCheckIn').value,
        check_out_date: document.getElementById('bookingCheckOut').value
    };
    
    if (!booking.customer_id || !booking.room_number || !booking.hotel_id) {
        alert('Please fill in all fields');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/bookings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(booking)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert(`Booking created successfully! Booking ID: ${result.booking_id}`);
            loadCustomerBookings();
            searchRooms();
        } else {
            alert(`Error: ${result.error}`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

async function loadCustomerBookings() {
    const customerId = document.getElementById('bookingCustomerId').value;
    if (!customerId) return;
    
    try {
        const response = await fetch(`${API_URL}/customers/${customerId}/bookings`);
        const bookings = await response.json();
        
        const container = document.getElementById('customerBookings');
        
        if (!bookings || bookings.length === 0) {
            container.innerHTML = '<div class="message info">No active bookings found.</div>';
            return;
        }
        
        let html = '<div class="table-wrapper"><table><thead><tr>';
        html += '<th>Booking ID</th><th>Hotel</th><th>Room</th><th>Check-in</th><th>Check-out</th><th>Status</th>';
        html += '</tr></thead><tbody>';
        
        bookings.forEach(booking => {
            html += `<tr>
                <td>${booking.booking_id}</td>
                <td>${booking.hotel_name}</td>
                <td>${booking.room_number}</td>
                <td>${booking.check_in_date}</td>
                <td>${booking.check_out_date}</td>
                <td>${booking.status}</td>
            </tr>`;
        });
        
        html += '</tbody></table></div>';
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading bookings:', error);
    }
}

async function loadEmployeeData() {
    await loadPendingBookings();
    await loadAllCustomers();
    await loadAllEmployees();
    await loadAllHotels();
    await loadAllRooms();
    await loadViews();
}

async function loadPendingBookings() {
    try {
        const response = await fetch(`${API_URL}/bookings/pending`);
        const bookings = await response.json();
        
        const container = document.getElementById('pendingBookings');
        
        if (!bookings || bookings.length === 0) {
            container.innerHTML = '<div class="message info">No pending bookings to convert.</div>';
            return;
        }
        
        let html = '<div class="table-wrapper"><table><thead><tr>';
        html += '<th>Booking ID</th><th>Customer</th><th>Hotel</th><th>Room</th><th>Check-in</th><th>Check-out</th><th>Action</th>';
        html += '</tr></thead><tbody>';
        
        bookings.forEach(booking => {
            html += `<tr>
                <td>${booking.booking_id}</td>
                <td>${booking.customer_name}</td>
                <td>${booking.hotel_name}</td>
                <td>${booking.room_number}</td>
                <td>${booking.check_in_date}</td>
                <td>${booking.check_out_date}</td>
                <td><button class="action-btn" onclick="convertToRenting(${booking.booking_id}, ${booking.room_number}, ${booking.hotel_id}, ${booking.customer_id})">Check-in</button></td>
            </tr>`;
        });
        
        html += '</tbody></table></div>';
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading pending bookings:', error);
    }
}

async function convertToRenting(bookingId, roomNumber, hotelId, customerId) {
    const employeeId = prompt('Enter your Employee ID:');
    if (!employeeId) return;
    
    const amountDue = prompt('Enter total amount due:');
    if (!amountDue) return;
    
    const checkOutDate = prompt('Enter check-out date (YYYY-MM-DD):');
    if (!checkOutDate) return;
    
    const renting = {
        booking_id: bookingId,
        customer_id: customerId,
        room_number: roomNumber,
        hotel_id: hotelId,
        employee_id: parseInt(employeeId),
        amount_due: parseFloat(amountDue),
        check_in_date: new Date().toISOString().split('T')[0],
        check_out_date: checkOutDate
    };
    
    try {
        const response = await fetch(`${API_URL}/rentings/from-booking`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(renting)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert(`Renting created successfully! Renting ID: ${result.renting_id}`);
            loadPendingBookings();
            searchRooms();
        } else {
            alert(`Error: ${result.error}`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

function showDirectRentForm(roomNumber, hotelId, price) {
    document.getElementById('directRoomNumber').value = roomNumber;
    document.getElementById('directHotelId').value = hotelId;
    document.getElementById('directAmountDue').value = price;
    document.getElementById('directCheckIn').value = new Date().toISOString().split('T')[0];
    document.getElementById('directCustomerId').focus();
}

async function createDirectRenting() {
    const renting = {
        customer_id: parseInt(document.getElementById('directCustomerId').value),
        room_number: parseInt(document.getElementById('directRoomNumber').value),
        hotel_id: parseInt(document.getElementById('directHotelId').value),
        employee_id: parseInt(document.getElementById('directEmployeeId').value),
        amount_due: parseFloat(document.getElementById('directAmountDue').value),
        check_in_date: document.getElementById('directCheckIn').value,
        check_out_date: document.getElementById('directCheckOut').value
    };
    
    if (!renting.customer_id || !renting.room_number || !renting.hotel_id || !renting.employee_id) {
        alert('Please fill in all fields');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/rentings/direct`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(renting)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert(`Direct renting created successfully! Renting ID: ${result.renting_id}`);
            searchRooms();
            document.getElementById('directCustomerId').value = '';
            document.getElementById('directRoomNumber').value = '';
            document.getElementById('directHotelId').value = '';
            document.getElementById('directEmployeeId').value = '';
            document.getElementById('directAmountDue').value = '';
            document.getElementById('directCheckOut').value = '';
        } else {
            alert(`Error: ${result.error}`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

async function processPayment() {
    const payment = {
        renting_id: parseInt(document.getElementById('paymentRentingId').value),
        amount_paid: parseFloat(document.getElementById('paymentAmount').value),
        payment_method: document.getElementById('paymentMethod').value
    };
    
    if (!payment.renting_id || !payment.amount_paid) {
        alert('Please fill in all fields');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/payments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payment)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert(`Payment recorded successfully!`);
            document.getElementById('paymentRentingId').value = '';
            document.getElementById('paymentAmount').value = '';
        } else {
            alert(`Error: ${result.error}`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

// ==================== CUSTOMER CRUD WITH UPDATE ====================
async function loadAllCustomers() {
    try {
        const response = await fetch(`${API_URL}/customers`);
        const customers = await response.json();
        
        let html = '<div class="table-wrapper"><table><thead><tr>';
        html += '<th>ID</th><th>Name</th><th>Address</th><th>ID Type</th><th>ID Value</th><th>Registered</th>';
        html += '</tr></thead><tbody>';
        
        customers.forEach(c => {
            html += `<tr>
                <td>${c.customer_id}</td>
                <td>${c.full_name}</td>
                <td>${c.address || '-'}</td>
                <td>${c.id_type || '-'}</td>
                <td>${c.id_value}</td>
                <td>${c.registration_date}</td>
            </tr>`;
        });
        
        html += '</tbody></table></div>';
        document.getElementById('customersList').innerHTML = html;
        
    } catch (error) {
        console.error('Error loading customers:', error);
        document.getElementById('customersList').innerHTML = '<div class="message error">Error loading customers</div>';
    }
}

async function addCustomer() {
    const customer = {
        full_name: document.getElementById('custName').value,
        address: document.getElementById('custAddress').value,
        id_type: document.getElementById('custIdType').value,
        id_value: document.getElementById('custIdValue').value
    };
    
    if (!customer.full_name || !customer.id_value) {
        alert('Please fill in required fields');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/customers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(customer)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert(`Customer added successfully! ID: ${result.customer_id}`);
            loadAllCustomers();
            document.getElementById('custName').value = '';
            document.getElementById('custAddress').value = '';
            document.getElementById('custIdValue').value = '';
        } else {
            alert(`Error: ${result.error}`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

async function updateCustomer() {
    const customerId = document.getElementById('updateCustomerId').value;
    const fullName = document.getElementById('updateCustName').value;
    const address = document.getElementById('updateCustAddress').value;
    
    if (!customerId) {
        alert('Please enter Customer ID to update');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/customers/${customerId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ full_name: fullName, address: address })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert(`Customer updated successfully!`);
            loadAllCustomers();
            document.getElementById('updateCustomerId').value = '';
            document.getElementById('updateCustName').value = '';
            document.getElementById('updateCustAddress').value = '';
        } else {
            alert(`Error: ${result.error}`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

async function deleteCustomer() {
    const customerId = document.getElementById('deleteCustomerId').value;
    if (!customerId) {
        alert('Enter Customer ID to delete');
        return;
    }
    
    if (!confirm('Are you sure? This will delete all bookings and rentings for this customer.')) return;
    
    try {
        const response = await fetch(`${API_URL}/customers/${customerId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('Customer deleted successfully');
            loadAllCustomers();
            document.getElementById('deleteCustomerId').value = '';
        } else {
            const error = await response.json();
            alert(`Error: ${error.error}`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

// ==================== EMPLOYEE CRUD WITH UPDATE ====================
async function loadAllEmployees() {
    try {
        const response = await fetch(`${API_URL}/employees`);
        const employees = await response.json();
        
        let html = '<div class="table-wrapper"><table><thead><tr>';
        html += '<th>ID</th><th>Name</th><th>Address</th><th>SSN/SIN</th><th>Role</th><th>Hotel ID</th>';
        html += '</tr></thead><tbody>';
        
        employees.forEach(e => {
            html += `<tr>
                <td>${e.employee_id}</td>
                <td>${e.full_name}</td>
                <td>${e.address || '-'}</td>
                <td>${e.ssn_sin}</td>
                <td>${e.role}</td>
                <td>${e.hotel_id}</td>
            </tr>`;
        });
        
        html += '</tbody></table></div>';
        document.getElementById('employeesList').innerHTML = html;
        
    } catch (error) {
        console.error('Error loading employees:', error);
        document.getElementById('employeesList').innerHTML = '<div class="message error">Error loading employees</div>';
    }
}

async function addEmployee() {
    const employee = {
        full_name: document.getElementById('empName').value,
        address: document.getElementById('empAddress').value,
        ssn_sin: document.getElementById('empSsn').value,
        role: document.getElementById('empRole').value,
        hotel_id: parseInt(document.getElementById('empHotelId').value)
    };
    
    if (!employee.full_name || !employee.ssn_sin || !employee.role || !employee.hotel_id) {
        alert('Please fill in all required fields');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/employees`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(employee)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert(`Employee added successfully! ID: ${result.employee_id}`);
            loadAllEmployees();
            document.getElementById('empName').value = '';
            document.getElementById('empAddress').value = '';
            document.getElementById('empSsn').value = '';
            document.getElementById('empRole').value = '';
            document.getElementById('empHotelId').value = '';
        } else {
            alert(`Error: ${result.error}`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

async function updateEmployee() {
    const employeeId = document.getElementById('updateEmployeeId').value;
    const fullName = document.getElementById('updateEmpName').value;
    const role = document.getElementById('updateEmpRole').value;
    
    if (!employeeId) {
        alert('Please enter Employee ID to update');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/employees/${employeeId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ full_name: fullName, role: role })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert(`Employee updated successfully!`);
            loadAllEmployees();
            document.getElementById('updateEmployeeId').value = '';
            document.getElementById('updateEmpName').value = '';
            document.getElementById('updateEmpRole').value = '';
        } else {
            alert(`Error: ${result.error}`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

async function deleteEmployee() {
    const employeeId = document.getElementById('deleteEmployeeId').value;
    if (!employeeId) {
        alert('Enter Employee ID to delete');
        return;
    }
    
    if (!confirm('Are you sure?')) return;
    
    try {
        const response = await fetch(`${API_URL}/employees/${employeeId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('Employee deleted successfully');
            loadAllEmployees();
            document.getElementById('deleteEmployeeId').value = '';
        } else {
            const error = await response.json();
            alert(`Error: ${error.error}`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

// ==================== HOTEL CRUD WITH UPDATE ====================
async function loadAllHotels() {
    try {
        const response = await fetch(`${API_URL}/hotels/all`);
        const hotels = await response.json();
        
        let html = '<div class="table-wrapper"><table><thead><tr>';
        html += '<th>ID</th><th>Name</th><th>Address</th><th>Category</th><th>Chain ID</th><th>Total Rooms</th>';
        html += '</tr></thead><tbody>';
        
        hotels.forEach(h => {
            let stars = '';
            for (let i = 0; i < h.category; i++) stars += '★';
            html += `<tr>
                <td>${h.hotel_id}</td>
                <td>${h.name}</td>
                <td>${h.address}</td>
                <td>${stars || h.category}</td>
                <td>${h.chain_id}</td>
                <td>${h.number_of_rooms || 0}</td>
            </tr>`;
        });
        
        html += '</tbody></table></div>';
        document.getElementById('hotelsList').innerHTML = html;
        
    } catch (error) {
        console.error('Error loading hotels:', error);
        document.getElementById('hotelsList').innerHTML = '<div class="message error">Error loading hotels</div>';
    }
}

async function addHotel() {
    const hotel = {
        hotel_id: parseInt(document.getElementById('hotelId').value),
        name: document.getElementById('hotelName').value,
        address: document.getElementById('hotelAddress').value,
        category: parseInt(document.getElementById('hotelCategory').value),
        email: document.getElementById('hotelEmail').value,
        phone_number: document.getElementById('hotelPhone').value,
        chain_id: parseInt(document.getElementById('hotelChainId').value)
    };
    
    if (!hotel.hotel_id || !hotel.name || !hotel.address || !hotel.category || !hotel.chain_id) {
        alert('Please fill in all required fields');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/hotels`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(hotel)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert(`Hotel added successfully!`);
            loadAllHotels();
            document.getElementById('hotelId').value = '';
            document.getElementById('hotelName').value = '';
            document.getElementById('hotelAddress').value = '';
            document.getElementById('hotelCategory').value = '';
            document.getElementById('hotelEmail').value = '';
            document.getElementById('hotelPhone').value = '';
            document.getElementById('hotelChainId').value = '';
        } else {
            alert(`Error: ${result.error}`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

async function updateHotel() {
    const hotelId = document.getElementById('updateHotelId').value;
    const name = document.getElementById('updateHotelName').value;
    const category = document.getElementById('updateHotelCategory').value;
    
    if (!hotelId) {
        alert('Please enter Hotel ID to update');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/hotels/${hotelId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name, category: category })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert(`Hotel updated successfully!`);
            loadAllHotels();
            document.getElementById('updateHotelId').value = '';
            document.getElementById('updateHotelName').value = '';
            document.getElementById('updateHotelCategory').value = '';
        } else {
            alert(`Error: ${result.error}`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

async function deleteHotel() {
    const hotelId = document.getElementById('deleteHotelId').value;
    if (!hotelId) {
        alert('Enter Hotel ID to delete');
        return;
    }
    
    if (!confirm('Are you sure? This will delete all rooms and employees in this hotel.')) return;
    
    try {
        const response = await fetch(`${API_URL}/hotels/${hotelId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('Hotel deleted successfully');
            loadAllHotels();
            document.getElementById('deleteHotelId').value = '';
        } else {
            const error = await response.json();
            alert(`Error: ${error.error}`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

// ==================== ROOM CRUD WITH UPDATE ====================
async function loadAllRooms() {
    try {
        const response = await fetch(`${API_URL}/rooms/all`);
        const rooms = await response.json();
        
        let html = '<div class="table-wrapper"><table><thead><tr>';
        html += '<th>Hotel</th><th>Room Number</th><th>Price</th><th>Capacity</th><th>View</th><th>Can Extend</th>';
        html += '</tr></thead><tbody>';
        
        rooms.forEach(r => {
            html += `<tr>
                <td>${r.hotel_name || r.hotel_id}</td>
                <td>${r.room_number}</td>
                <td>$${r.price}</td>
                <td>${r.capacity}</td>
                <td>${r.view_type || '-'}</td>
                <td>${r.can_extend ? 'Yes' : 'No'}</td>
            </tr>`;
        });
        
        html += '</tbody></table></div>';
        document.getElementById('roomsList').innerHTML = html;
        
    } catch (error) {
        console.error('Error loading rooms:', error);
        document.getElementById('roomsList').innerHTML = '<div class="message error">Error loading rooms</div>';
    }
}

async function addRoom() {
    const room = {
        room_number: parseInt(document.getElementById('roomNumber').value),
        hotel_id: parseInt(document.getElementById('roomHotelId').value),
        price: parseFloat(document.getElementById('roomPrice').value),
        capacity: document.getElementById('roomCapacity').value,
        view_type: document.getElementById('roomView').value,
        can_extend: document.getElementById('roomCanExtend').value === 'true'
    };
    
    if (!room.room_number || !room.hotel_id || !room.price || !room.capacity) {
        alert('Please fill in all required fields');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/rooms`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(room)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert(`Room added successfully!`);
            loadAllRooms();
            searchRooms();
            document.getElementById('roomNumber').value = '';
            document.getElementById('roomHotelId').value = '';
            document.getElementById('roomPrice').value = '';
        } else {
            alert(`Error: ${result.error}`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

async function updateRoom() {
    const roomNumber = document.getElementById('updateRoomNumber').value;
    const hotelId = document.getElementById('updateRoomHotelId').value;
    const price = document.getElementById('updateRoomPrice').value;
    
    if (!roomNumber || !hotelId) {
        alert('Please enter Room Number and Hotel ID to update');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/rooms/${roomNumber}/${hotelId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ price: parseFloat(price) })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert(`Room price updated successfully!`);
            loadAllRooms();
            searchRooms();
            document.getElementById('updateRoomNumber').value = '';
            document.getElementById('updateRoomHotelId').value = '';
            document.getElementById('updateRoomPrice').value = '';
        } else {
            alert(`Error: ${result.error}`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

async function deleteRoom() {
    const roomNumber = document.getElementById('deleteRoomNumber').value;
    const hotelId = document.getElementById('deleteRoomHotelId').value;
    
    if (!roomNumber || !hotelId) {
        alert('Enter Room Number and Hotel ID');
        return;
    }
    
    if (!confirm('Are you sure?')) return;
    
    try {
        const response = await fetch(`${API_URL}/rooms/${roomNumber}/${hotelId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('Room deleted successfully');
            loadAllRooms();
            searchRooms();
            document.getElementById('deleteRoomNumber').value = '';
            document.getElementById('deleteRoomHotelId').value = '';
        } else {
            const error = await response.json();
            alert(`Error: ${error.error}`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

// ==================== SQL VIEWS ====================
async function loadViews() {
    try {
        const view1Res = await fetch(`${API_URL}/views/available-rooms-per-area`);
        if (view1Res.ok) {
            const view1 = await view1Res.json();
            
            let html1 = '<div class="table-wrapper"><table><thead><tr>';
            html1 += '<th>Area</th><th>Total Rooms</th><th>Available Rooms</th>';
            html1 += '</tr></thead><tbody>';
            
            view1.forEach(row => {
                html1 += `<tr>
                    <td>${row.area}</td>
                    <td>${row.total_rooms}</td>
                    <td>${row.available_rooms}</td>
                </tr>`;
            });
            
            html1 += '</tbody></table></div>';
            document.getElementById('view1Results').innerHTML = html1;
        }
        
        const view2Res = await fetch(`${API_URL}/views/hotel-total-capacity`);
        if (view2Res.ok) {
            const view2 = await view2Res.json();
            
            let html2 = '<div class="table-wrapper"><table><thead><tr>';
            html2 += '<th>Hotel ID</th><th>Hotel Name</th><th>Total Capacity (Guests)</th>';
            html2 += '</tr></thead><tbody>';
            
            view2.forEach(row => {
                html2 += `<tr>
                    <td>${row.hotel_id}</td>
                    <td>${row.name}</td>
                    <td>${row.total_capacity_guests}</td>
                </tr>`;
            });
            
            html2 += '</tbody></table></div>';
            document.getElementById('view2Results').innerHTML = html2;
        }
        
    } catch (error) {
        console.error('Error loading views:', error);
    }
}

// ==================== TAB MANAGEMENT ====================
function showEmployeeTab(tabName) {
    document.querySelectorAll('.employee-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('.tab').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.getElementById(`${tabName}Tab`).classList.add('active');
    
    const clickedButton = Array.from(document.querySelectorAll('.tab')).find(
        btn => btn.textContent.toLowerCase().includes(tabName.toLowerCase())
    );
    if (clickedButton) {
        clickedButton.classList.add('active');
    }
    
    if (tabName === 'bookings') loadPendingBookings();
    if (tabName === 'crudCustomers') loadAllCustomers();
    if (tabName === 'crudEmployees') loadAllEmployees();
    if (tabName === 'crudHotels') loadAllHotels();
    if (tabName === 'crudRooms') loadAllRooms();
    if (tabName === 'views') loadViews();
}