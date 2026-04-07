const API_URL = 'http://localhost:5000/api';
let currentRole = 'customer';
let activeBookingRow = null;

document.addEventListener('DOMContentLoaded', () => {
    checkBackendConnection();
    loadFilters();
    setRole('customer');
});

async function checkBackendConnection() {
    try {
        const response = await fetch(`${API_URL}/health`);
        if (!response.ok) throw new Error();
    } catch (error) {
        const resultsDiv = document.getElementById('searchResults');
        if (resultsDiv) {
            resultsDiv.innerHTML = '<div class="message error">Cannot connect to backend. Please run: python3 backend/app.py</div>';
            document.getElementById('resultsSection').style.display = 'block';
        }
    }
}

function setRole(role) {
    currentRole = role;
    closeBookingPanel();

    const banner = document.getElementById('modeBanner');
    const isCustomer = role === 'customer';

    banner.className = `mode-banner ${isCustomer ? 'customer' : 'employee'}-mode`;
    banner.innerHTML = `
        <div class="mode-icon"></div>
        <div class="mode-text">
            <strong>${isCustomer ? 'Customer mode' : 'Employee mode'}</strong>
            ${isCustomer ? 'Search for rooms and make bookings' : 'Manage bookings, rentings, payments, and hotel data'}
        </div>
        <div class="mode-switch">
            <button class="switch-btn" onclick="setRole('customer')">Customer</button>
            <button class="switch-btn" onclick="setRole('employee')">Employee</button>
        </div>
    `;

    document.getElementById('customerSection').style.display = isCustomer ? 'block' : 'none';
    document.getElementById('employeeSection').style.display = isCustomer ? 'none' : 'block';

    if (!isCustomer) loadEmployeeData();

    const resultsSection = document.getElementById('resultsSection');
    if (resultsSection.style.display !== 'none') {
        searchRooms(true);
    }
}

async function loadFilters() {
    try {
        const areasRes = await fetch(`${API_URL}/areas`);
        if (areasRes.ok) {
            const areas = await areasRes.json();
            const sel = document.getElementById('area');
            areas.forEach(a => {
                const o = document.createElement('option');
                o.value = a.area; o.textContent = a.area;
                sel.appendChild(o);
            });
        }
        const chainsRes = await fetch(`${API_URL}/chains`);
        if (chainsRes.ok) {
            const chains = await chainsRes.json();
            const sel = document.getElementById('chain');
            chains.forEach(c => {
                const o = document.createElement('option');
                o.value = c.chain_id; o.textContent = c.name;
                sel.appendChild(o);
            });
        }
    } catch (e) { console.error('Error loading filters:', e); }
}

async function searchRooms(silent = false) {
    const resultsSection = document.getElementById('resultsSection');
    resultsSection.style.display = 'block';

    const params = new URLSearchParams({
        check_in:    document.getElementById('checkIn').value,
        check_out:   document.getElementById('checkOut').value,
        capacity:    document.getElementById('capacity').value,
        area:        document.getElementById('area').value,
        chain_id:    document.getElementById('chain').value,
        category:    document.getElementById('category').value,
        total_rooms: document.getElementById('totalRooms').value,
        min_price:   document.getElementById('minPrice').value || 0,
        max_price:   document.getElementById('maxPrice').value || 9999
    });

    const resultsDiv = document.getElementById('searchResults');
    if (!silent) {
        resultsDiv.innerHTML = '<div class="loading"><div class="spinner"></div><p>Searching rooms…</p></div>';
    }

    closeBookingPanel();

    try {
        const response = await fetch(`${API_URL}/rooms/search?${params}`);
        if (!response.ok) throw new Error(`Server returned ${response.status}`);

        const rooms = await response.json();

        if (!rooms || rooms.length === 0) {
            resultsDiv.innerHTML = '<div class="message info">No rooms available for the selected criteria.</div>';
            document.getElementById('resultCount').textContent = '0 rooms found';
            return;
        }

        const colCount = currentRole === 'customer' ? 6 : 6;
        let html = `<div class="table-wrapper"><table><thead><tr>
            <th>Hotel</th><th>Room</th><th>Capacity</th><th>Price</th><th>View</th><th>Action</th>
        </tr></thead><tbody>`;

        rooms.forEach((room, i) => {
            html += `<tr id="room-row-${i}" data-row="${i}">
                <td>${room.hotel_name || room.hotel_id}</td>
                <td>${room.room_number}</td>
                <td>${room.capacity}</td>
                <td>$${room.price}</td>
                <td>${room.view_type || '—'}</td>
                <td>`;

            if (currentRole === 'customer') {
                html += `<button class="action-btn book" id="book-btn-${i}"
                    onclick="toggleBookingPanel(${i}, ${room.room_number}, ${room.hotel_id}, ${room.price}, '${(room.hotel_name||'').replace(/'/g,"\\'")}')">
                    Book
                </button>`;
            } else {
                html += `<button class="action-btn rent"
                    onclick="showDirectRentForm(${room.room_number}, ${room.hotel_id}, ${room.price})">
                    Rent now
                </button>`;
            }

            html += `</td></tr>`;
        });

        html += '</tbody></table></div>';
        resultsDiv.innerHTML = html;
        document.getElementById('resultCount').textContent = `${rooms.length} room${rooms.length !== 1 ? 's' : ''} found`;

    } catch (error) {
        console.error('Search error:', error);
        resultsDiv.innerHTML = `<div class="message error">Error searching rooms: ${error.message}</div>`;
        document.getElementById('resultCount').textContent = 'Error';
    }
}

function toggleBookingPanel(rowIndex, roomNumber, hotelId, price, hotelName) {
    if (activeBookingRow === rowIndex) {
        closeBookingPanel();
        return;
    }
    closeBookingPanel();
    activeBookingRow = rowIndex;

    const btn = document.getElementById(`book-btn-${rowIndex}`);
    if (btn) btn.classList.add('active');

    const row = document.getElementById(`room-row-${rowIndex}`);
    if (!row) return;

    const colCount = row.cells.length;
    const panelRow = document.createElement('tr');
    panelRow.id = 'booking-panel-row';
    panelRow.className = 'booking-panel-row';
    panelRow.innerHTML = `<td colspan="${colCount}">
        <div class="booking-panel">
            <div class="booking-panel-header">
                <div class="booking-panel-title">Book room ${roomNumber} — ${hotelName}</div>
                <button class="booking-panel-close" onclick="closeBookingPanel()">✕</button>
            </div>
            <div class="form-grid">
                <div class="form-field">
                    <label>Your customer ID</label>
                    <input type="number" id="bpCustomerId" placeholder="Enter your ID">
                </div>
                <div class="form-field">
                    <label>Check-in date</label>
                    <input type="date" id="bpCheckIn" value="${document.getElementById('checkIn').value}">
                </div>
                <div class="form-field">
                    <label>Check-out date</label>
                    <input type="date" id="bpCheckOut" value="${document.getElementById('checkOut').value}">
                </div>
            </div>
            <input type="hidden" id="bpRoomNumber" value="${roomNumber}">
            <input type="hidden" id="bpHotelId" value="${hotelId}">
            <button class="submit-btn" onclick="createBooking()">Confirm booking</button>
            <div id="bpMessage" style="margin-top:10px;"></div>
        </div>
    </td>`;

    row.insertAdjacentElement('afterend', panelRow);
    setTimeout(() => document.getElementById('bpCustomerId').focus(), 50);
}

function closeBookingPanel() {
    const existing = document.getElementById('booking-panel-row');
    if (existing) existing.remove();

    if (activeBookingRow !== null) {
        const btn = document.getElementById(`book-btn-${activeBookingRow}`);
        if (btn) btn.classList.remove('active');
        activeBookingRow = null;
    }
}

async function createBooking() {
    const booking = {
        customer_id:    parseInt(document.getElementById('bpCustomerId').value),
        room_number:    parseInt(document.getElementById('bpRoomNumber').value),
        hotel_id:       parseInt(document.getElementById('bpHotelId').value),
        check_in_date:  document.getElementById('bpCheckIn').value,
        check_out_date: document.getElementById('bpCheckOut').value
    };

    const msgDiv = document.getElementById('bpMessage');

    if (!booking.customer_id || !booking.room_number || !booking.hotel_id) {
        msgDiv.innerHTML = '<div class="message error">Please fill in all fields.</div>';
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
            msgDiv.innerHTML = `<div class="message success">Booking confirmed! ID: ${result.booking_id}</div>`;
            setTimeout(() => {
                closeBookingPanel();
                searchRooms(true);
            }, 1800);

            const custId = document.getElementById('bookingCustomerId');
            if (custId && !custId.value) custId.value = booking.customer_id;
            loadCustomerBookings();
        } else {
            msgDiv.innerHTML = `<div class="message error">${result.error}</div>`;
        }
    } catch (error) {
        msgDiv.innerHTML = `<div class="message error">${error.message}</div>`;
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

        bookings.forEach(b => {
            html += `<tr>
                <td>${b.booking_id}</td>
                <td>${b.hotel_name}</td>
                <td>${b.room_number}</td>
                <td>${b.check_in_date}</td>
                <td>${b.check_out_date}</td>
                <td><span class="badge badge-pending">${b.status}</span></td>
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

        bookings.forEach(b => {
            html += `<tr>
                <td>${b.booking_id}</td>
                <td>${b.customer_name}</td>
                <td>${b.hotel_name}</td>
                <td>${b.room_number}</td>
                <td>${b.check_in_date}</td>
                <td>${b.check_out_date}</td>
                <td><button class="action-btn" onclick="convertToRenting(${b.booking_id}, ${b.room_number}, ${b.hotel_id}, ${b.customer_id})">Check in</button></td>
            </tr>`;
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;
    } catch (error) { console.error('Error loading pending bookings:', error); }
}

async function convertToRenting(bookingId, roomNumber, hotelId, customerId) {
    const employeeId = prompt('Enter your employee ID:');
    if (!employeeId) return;
    const amountDue = prompt('Enter total amount due ($):');
    if (!amountDue) return;
    const checkOutDate = prompt('Enter check-out date (YYYY-MM-DD):');
    if (!checkOutDate) return;

    const renting = {
        booking_id: bookingId, customer_id: customerId,
        room_number: roomNumber, hotel_id: hotelId,
        employee_id: parseInt(employeeId), amount_due: parseFloat(amountDue),
        check_in_date: new Date().toISOString().split('T')[0], check_out_date: checkOutDate
    };

    try {
        const response = await fetch(`${API_URL}/rentings/from-booking`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(renting)
        });
        const result = await response.json();
        if (response.ok) { alert(`Renting created! ID: ${result.renting_id}`); loadPendingBookings(); searchRooms(true); }
        else alert(`Error: ${result.error}`);
    } catch (error) { alert(`Error: ${error.message}`); }
}

function showDirectRentForm(roomNumber, hotelId, price) {
    showEmployeeTab('directRent');
    document.getElementById('directRoomNumber').value = roomNumber;
    document.getElementById('directHotelId').value = hotelId;
    document.getElementById('directAmountDue').value = price;
    document.getElementById('directCheckIn').value = new Date().toISOString().split('T')[0];
    document.getElementById('directCustomerId').focus();
}

async function createDirectRenting() {
    const renting = {
        customer_id:    parseInt(document.getElementById('directCustomerId').value),
        room_number:    parseInt(document.getElementById('directRoomNumber').value),
        hotel_id:       parseInt(document.getElementById('directHotelId').value),
        employee_id:    parseInt(document.getElementById('directEmployeeId').value),
        amount_due:     parseFloat(document.getElementById('directAmountDue').value),
        check_in_date:  document.getElementById('directCheckIn').value,
        check_out_date: document.getElementById('directCheckOut').value
    };

    if (!renting.customer_id || !renting.room_number || !renting.hotel_id || !renting.employee_id) {
        alert('Please fill in all required fields'); return;
    }

    try {
        const response = await fetch(`${API_URL}/rentings/direct`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(renting)
        });
        const result = await response.json();
        if (response.ok) {
            alert(`Direct renting created! ID: ${result.renting_id}`);
            searchRooms(true);
            ['directCustomerId','directRoomNumber','directHotelId','directEmployeeId','directAmountDue','directCheckOut'].forEach(id => document.getElementById(id).value = '');
        } else alert(`Error: ${result.error}`);
    } catch (error) { alert(`Error: ${error.message}`); }
}

async function processPayment() {
    const payment = {
        renting_id:     parseInt(document.getElementById('paymentRentingId').value),
        amount_paid:    parseFloat(document.getElementById('paymentAmount').value),
        payment_method: document.getElementById('paymentMethod').value
    };

    if (!payment.renting_id || !payment.amount_paid) { alert('Please fill in all fields'); return; }

    try {
        const response = await fetch(`${API_URL}/payments`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payment)
        });
        const result = await response.json();
        if (response.ok) {
            alert('Payment recorded!');
            document.getElementById('paymentRentingId').value = '';
            document.getElementById('paymentAmount').value = '';
        } else alert(`Error: ${result.error}`);
    } catch (error) { alert(`Error: ${error.message}`); }
}

async function loadAllCustomers() {
    try {
        const response = await fetch(`${API_URL}/customers`);
        const customers = await response.json();

        let html = '<div class="table-wrapper"><table><thead><tr><th>ID</th><th>Name</th><th>Address</th><th>ID type</th><th>ID value</th><th>Registered</th></tr></thead><tbody>';
        customers.forEach(c => {
            html += `<tr><td>${c.customer_id}</td><td>${c.full_name}</td><td>${c.address||'—'}</td><td>${c.id_type||'—'}</td><td>${c.id_value}</td><td>${c.registration_date}</td></tr>`;
        });
        html += '</tbody></table></div>';
        document.getElementById('customersList').innerHTML = html;
    } catch (error) {
        document.getElementById('customersList').innerHTML = '<div class="message error">Error loading customers</div>';
    }
}

async function addCustomer() {
    const customer = {
        full_name: document.getElementById('custName').value,
        address:   document.getElementById('custAddress').value,
        id_type:   document.getElementById('custIdType').value,
        id_value:  document.getElementById('custIdValue').value
    };
    if (!customer.full_name || !customer.id_value) { alert('Please fill in required fields'); return; }

    try {
        const response = await fetch(`${API_URL}/customers`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(customer)
        });
        const result = await response.json();
        if (response.ok) {
            alert(`Customer added! ID: ${result.customer_id}`);
            loadAllCustomers();
            ['custName','custAddress','custIdValue'].forEach(id => document.getElementById(id).value = '');
        } else alert(`Error: ${result.error}`);
    } catch (error) { alert(`Error: ${error.message}`); }
}

async function updateCustomer() {
    const customerId = document.getElementById('updateCustomerId').value;
    if (!customerId) { alert('Please enter a customer ID'); return; }
    try {
        const response = await fetch(`${API_URL}/customers/${customerId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ full_name: document.getElementById('updateCustName').value, address: document.getElementById('updateCustAddress').value })
        });
        const result = await response.json();
        if (response.ok) {
            alert('Customer updated!'); loadAllCustomers();
            ['updateCustomerId','updateCustName','updateCustAddress'].forEach(id => document.getElementById(id).value = '');
        } else alert(`Error: ${result.error}`);
    } catch (error) { alert(`Error: ${error.message}`); }
}

async function deleteCustomer() {
    const id = document.getElementById('deleteCustomerId').value;
    if (!id) { alert('Enter a customer ID'); return; }
    if (!confirm('Delete this customer and all their bookings/rentings?')) return;
    try {
        const response = await fetch(`${API_URL}/customers/${id}`, { method: 'DELETE' });
        if (response.ok) { alert('Customer deleted'); loadAllCustomers(); document.getElementById('deleteCustomerId').value = ''; }
        else { const err = await response.json(); alert(`Error: ${err.error}`); }
    } catch (error) { alert(`Error: ${error.message}`); }
}

async function loadAllEmployees() {
    try {
        const response = await fetch(`${API_URL}/employees`);
        const employees = await response.json();
        let html = '<div class="table-wrapper"><table><thead><tr><th>ID</th><th>Name</th><th>Address</th><th>SSN/SIN</th><th>Role</th><th>Hotel ID</th></tr></thead><tbody>';
        employees.forEach(e => {
            html += `<tr><td>${e.employee_id}</td><td>${e.full_name}</td><td>${e.address||'—'}</td><td>${e.ssn_sin}</td><td>${e.role}</td><td>${e.hotel_id}</td></tr>`;
        });
        html += '</tbody></table></div>';
        document.getElementById('employeesList').innerHTML = html;
    } catch (error) {
        document.getElementById('employeesList').innerHTML = '<div class="message error">Error loading employees</div>';
    }
}

async function addEmployee() {
    const employee = {
        full_name: document.getElementById('empName').value,
        address:   document.getElementById('empAddress').value,
        ssn_sin:   document.getElementById('empSsn').value,
        role:      document.getElementById('empRole').value,
        hotel_id:  parseInt(document.getElementById('empHotelId').value)
    };
    if (!employee.full_name || !employee.ssn_sin || !employee.role || !employee.hotel_id) { alert('Please fill in all required fields'); return; }
    try {
        const response = await fetch(`${API_URL}/employees`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(employee)
        });
        const result = await response.json();
        if (response.ok) {
            alert(`Employee added! ID: ${result.employee_id}`); loadAllEmployees();
            ['empName','empAddress','empSsn','empRole','empHotelId'].forEach(id => document.getElementById(id).value = '');
        } else alert(`Error: ${result.error}`);
    } catch (error) { alert(`Error: ${error.message}`); }
}

async function updateEmployee() {
    const id = document.getElementById('updateEmployeeId').value;
    if (!id) { alert('Please enter an employee ID'); return; }
    try {
        const response = await fetch(`${API_URL}/employees/${id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ full_name: document.getElementById('updateEmpName').value, role: document.getElementById('updateEmpRole').value })
        });
        const result = await response.json();
        if (response.ok) {
            alert('Employee updated!'); loadAllEmployees();
            ['updateEmployeeId','updateEmpName','updateEmpRole'].forEach(id => document.getElementById(id).value = '');
        } else alert(`Error: ${result.error}`);
    } catch (error) { alert(`Error: ${error.message}`); }
}

async function deleteEmployee() {
    const id = document.getElementById('deleteEmployeeId').value;
    if (!id) { alert('Enter an employee ID'); return; }
    if (!confirm('Delete this employee?')) return;
    try {
        const response = await fetch(`${API_URL}/employees/${id}`, { method: 'DELETE' });
        if (response.ok) { alert('Employee deleted'); loadAllEmployees(); document.getElementById('deleteEmployeeId').value = ''; }
        else { const err = await response.json(); alert(`Error: ${err.error}`); }
    } catch (error) { alert(`Error: ${error.message}`); }
}

async function loadAllHotels() {
    try {
        const response = await fetch(`${API_URL}/hotels/all`);
        const hotels = await response.json();
        let html = '<div class="table-wrapper"><table><thead><tr><th>ID</th><th>Name</th><th>Address</th><th>Stars</th><th>Chain ID</th><th>Rooms</th></tr></thead><tbody>';
        hotels.forEach(h => {
            html += `<tr><td>${h.hotel_id}</td><td>${h.name}</td><td>${h.address}</td><td>${'★'.repeat(h.category)}</td><td>${h.chain_id}</td><td>${h.number_of_rooms||0}</td></tr>`;
        });
        html += '</tbody></table></div>';
        document.getElementById('hotelsList').innerHTML = html;
    } catch (error) {
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
    if (!hotel.hotel_id || !hotel.name || !hotel.address || !hotel.category || !hotel.chain_id) { alert('Please fill in all required fields'); return; }
    try {
        const response = await fetch(`${API_URL}/hotels`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(hotel)
        });
        const result = await response.json();
        if (response.ok) {
            alert('Hotel added!'); loadAllHotels();
            ['hotelId','hotelName','hotelAddress','hotelCategory','hotelEmail','hotelPhone','hotelChainId'].forEach(id => document.getElementById(id).value = '');
        } else alert(`Error: ${result.error}`);
    } catch (error) { alert(`Error: ${error.message}`); }
}

async function updateHotel() {
    const id = document.getElementById('updateHotelId').value;
    if (!id) { alert('Please enter a hotel ID'); return; }
    try {
        const response = await fetch(`${API_URL}/hotels/${id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: document.getElementById('updateHotelName').value, category: document.getElementById('updateHotelCategory').value })
        });
        const result = await response.json();
        if (response.ok) {
            alert('Hotel updated!'); loadAllHotels();
            ['updateHotelId','updateHotelName','updateHotelCategory'].forEach(id => document.getElementById(id).value = '');
        } else alert(`Error: ${result.error}`);
    } catch (error) { alert(`Error: ${error.message}`); }
}

async function deleteHotel() {
    const id = document.getElementById('deleteHotelId').value;
    if (!id) { alert('Enter a hotel ID'); return; }
    if (!confirm('Delete this hotel and all its rooms and employees?')) return;
    try {
        const response = await fetch(`${API_URL}/hotels/${id}`, { method: 'DELETE' });
        if (response.ok) { alert('Hotel deleted'); loadAllHotels(); document.getElementById('deleteHotelId').value = ''; }
        else { const err = await response.json(); alert(`Error: ${err.error}`); }
    } catch (error) { alert(`Error: ${error.message}`); }
}

async function loadAllRooms() {
    try {
        const response = await fetch(`${API_URL}/rooms/all`);
        const rooms = await response.json();
        let html = '<div class="table-wrapper"><table><thead><tr><th>Hotel</th><th>Room</th><th>Price</th><th>Capacity</th><th>View</th><th>Extendable</th></tr></thead><tbody>';
        rooms.forEach(r => {
            html += `<tr><td>${r.hotel_name||r.hotel_id}</td><td>${r.room_number}</td><td>$${r.price}</td><td>${r.capacity}</td><td>${r.view_type||'—'}</td><td>${r.can_extend?'Yes':'No'}</td></tr>`;
        });
        html += '</tbody></table></div>';
        document.getElementById('roomsList').innerHTML = html;
    } catch (error) {
        document.getElementById('roomsList').innerHTML = '<div class="message error">Error loading rooms</div>';
    }
}

async function addRoom() {
    const room = {
        room_number: parseInt(document.getElementById('roomNumber').value),
        hotel_id:    parseInt(document.getElementById('roomHotelId').value),
        price:       parseFloat(document.getElementById('roomPrice').value),
        capacity:    document.getElementById('roomCapacity').value,
        view_type:   document.getElementById('roomView').value,
        can_extend:  document.getElementById('roomCanExtend').value === 'true'
    };
    if (!room.room_number || !room.hotel_id || !room.price || !room.capacity) { alert('Please fill in all required fields'); return; }
    try {
        const response = await fetch(`${API_URL}/rooms`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(room)
        });
        const result = await response.json();
        if (response.ok) {
            alert('Room added!'); loadAllRooms(); searchRooms(true);
            ['roomNumber','roomHotelId','roomPrice'].forEach(id => document.getElementById(id).value = '');
        } else alert(`Error: ${result.error}`);
    } catch (error) { alert(`Error: ${error.message}`); }
}

async function updateRoom() {
    const num = document.getElementById('updateRoomNumber').value;
    const hotelId = document.getElementById('updateRoomHotelId').value;
    if (!num || !hotelId) { alert('Please enter room number and hotel ID'); return; }
    try {
        const response = await fetch(`${API_URL}/rooms/${num}/${hotelId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ price: parseFloat(document.getElementById('updateRoomPrice').value) })
        });
        const result = await response.json();
        if (response.ok) {
            alert('Room price updated!'); loadAllRooms(); searchRooms(true);
            ['updateRoomNumber','updateRoomHotelId','updateRoomPrice'].forEach(id => document.getElementById(id).value = '');
        } else alert(`Error: ${result.error}`);
    } catch (error) { alert(`Error: ${error.message}`); }
}

async function deleteRoom() {
    const num = document.getElementById('deleteRoomNumber').value;
    const hotelId = document.getElementById('deleteRoomHotelId').value;
    if (!num || !hotelId) { alert('Enter room number and hotel ID'); return; }
    if (!confirm('Delete this room?')) return;
    try {
        const response = await fetch(`${API_URL}/rooms/${num}/${hotelId}`, { method: 'DELETE' });
        if (response.ok) {
            alert('Room deleted'); loadAllRooms(); searchRooms(true);
            ['deleteRoomNumber','deleteRoomHotelId'].forEach(id => document.getElementById(id).value = '');
        } else { const err = await response.json(); alert(`Error: ${err.error}`); }
    } catch (error) { alert(`Error: ${error.message}`); }
}

async function loadViews() {
    try {
        const v1 = await fetch(`${API_URL}/views/available-rooms-per-area`);
        if (v1.ok) {
            const data = await v1.json();
            let html = '<div class="table-wrapper"><table><thead><tr><th>Area</th><th>Total rooms</th><th>Available</th></tr></thead><tbody>';
            data.forEach(r => { html += `<tr><td>${r.area}</td><td>${r.total_rooms}</td><td>${r.available_rooms}</td></tr>`; });
            html += '</tbody></table></div>';
            document.getElementById('view1Results').innerHTML = html;
        }
        const v2 = await fetch(`${API_URL}/views/hotel-total-capacity`);
        if (v2.ok) {
            const data = await v2.json();
            let html = '<div class="table-wrapper"><table><thead><tr><th>Hotel ID</th><th>Hotel name</th><th>Total capacity</th></tr></thead><tbody>';
            data.forEach(r => { html += `<tr><td>${r.hotel_id}</td><td>${r.name}</td><td>${r.total_capacity_guests}</td></tr>`; });
            html += '</tbody></table></div>';
            document.getElementById('view2Results').innerHTML = html;
        }
    } catch (error) { console.error('Error loading views:', error); }
}

function showEmployeeTab(tabName) {
    document.querySelectorAll('.employee-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.getElementById(`${tabName}Tab`).classList.add('active');
    const btn = Array.from(document.querySelectorAll('.tab')).find(b => b.onclick && b.onclick.toString().includes(`'${tabName}'`));
    if (btn) btn.classList.add('active');
    if (tabName === 'bookings') loadPendingBookings();
    if (tabName === 'crudCustomers') loadAllCustomers();
    if (tabName === 'crudEmployees') loadAllEmployees();
    if (tabName === 'crudHotels') loadAllHotels();
    if (tabName === 'crudRooms') loadAllRooms();
    if (tabName === 'views') loadViews();
}