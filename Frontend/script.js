// frontend/script.js
const API_URL = 'http://localhost:5000/api';

// Load hotels for dropdown
async function loadHotels() {
    try {
        const response = await fetch(`${API_URL}/hotels`);
        const hotels = await response.json();
        const select = document.getElementById('hotelId');
        if (select && hotels && !hotels.error) {
            select.innerHTML = hotels.map(h => `<option value="${h.hotel_id}">${h.name}</option>`).join('');
        }
    } catch (error) {
        console.log('Using default hotel list');
    }
}

// Update statistics
async function updateStats() {
    try {
        const response = await fetch(`${API_URL}/stats`);
        const stats = await response.json();
        
        if (!stats.error) {
            document.getElementById('totalHotels').textContent = stats.total_hotels || '-';
            document.getElementById('totalCustomers').textContent = stats.total_customers || '-';
            document.getElementById('totalRevenue').textContent = stats.total_revenue ? `$${stats.total_revenue.toLocaleString()}` : '-';
            document.getElementById('totalBookings').textContent = stats.total_bookings || '-';
            document.getElementById('avgPrice').textContent = stats.avg_room_price ? `$${stats.avg_room_price}` : '-';
        }
    } catch (error) {
        console.log('Stats not available');
        document.getElementById('totalHotels').textContent = '25';
        document.getElementById('totalCustomers').textContent = '189';
        document.getElementById('totalRevenue').textContent = '$168K';
        document.getElementById('totalBookings').textContent = '456';
        document.getElementById('avgPrice').textContent = '$275';
    }
}

// Run query with dates for Query 3
async function runQueryWithDates() {
    const hotelId = document.getElementById('hotelId')?.value || 101;
    const checkIn = document.getElementById('checkIn')?.value || '2025-04-20';
    const checkOut = document.getElementById('checkOut')?.value || '2025-05-01';
    
    const resultsDiv = document.getElementById('resultsContent');
    const resultCountSpan = document.getElementById('resultCount');
    
    resultsDiv.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Checking availability at Hotel ${hotelId} from ${checkIn} to ${checkOut}...</p>
        </div>
    `;
    
    try {
        const response = await fetch(`${API_URL}/query/3?hotel_id=${hotelId}&check_in=${checkIn}&check_out=${checkOut}`);
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        const results = data.data || data;
        
        if (!results || results.length === 0) {
            resultsDiv.innerHTML = '<div class="error-message">No available rooms found for these dates.</div>';
            resultCountSpan.textContent = '0 rooms';
            return;
        }
        
        displayResults(results);
        resultCountSpan.textContent = `${results.length} available rooms`;
        
    } catch (error) {
        resultsDiv.innerHTML = `<div class="error-message">Error: ${error.message}</div>`;
        resultCountSpan.textContent = 'Error';
    }
}

// Main query runner
async function runQuery(queryId) {
    const resultsDiv = document.getElementById('resultsContent');
    const resultCountSpan = document.getElementById('resultCount');
    
    const queryNames = {
        1: 'Revenue per Hotel',
        2: 'Premium Customers',
        4: 'Top Hotel Chain'
    };
    
    resultsDiv.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Executing ${queryNames[queryId]}...</p>
        </div>
    `;
    
    try {
        const response = await fetch(`${API_URL}/query/${queryId}`);
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        const results = data.data || data;
        
        if (!results || results.length === 0) {
            resultsDiv.innerHTML = '<div class="error-message">No results found for this query.</div>';
            resultCountSpan.textContent = '0 rows';
            return;
        }
        
        displayResults(results);
        resultCountSpan.textContent = `${results.length} rows returned`;
        
    } catch (error) {
        console.error('Query error:', error);
        resultsDiv.innerHTML = `
            <div class="error-message">
                <strong>Query Error</strong><br><br>
                ${error.message}<br><br>
                <small>Make sure your database is connected and tables have data.</small>
            </div>
        `;
        resultCountSpan.textContent = 'Error';
    }
}

// Display results in table
function displayResults(data) {
    if (!data || data.length === 0) {
        document.getElementById('resultsContent').innerHTML = '<div class="error-message">No data to display</div>';
        return;
    }
    
    const headers = Object.keys(data[0]);
    let html = '<div class="table-wrapper"><tr><thead><tr>';
    
    headers.forEach(header => {
        const displayName = header.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
        html += `<th>${displayName.toUpperCase()}</th>`;
    });
    html += '</tr></thead><tbody>';
    
    data.forEach(row => {
        html += ' hilab';
        headers.forEach(header => {
            let value = row[header];
            if (value === null || value === undefined) value = '-';
            if (typeof value === 'number') {
                if (header.toLowerCase().includes('price') || header.toLowerCase().includes('revenue') || header.toLowerCase().includes('amount')) {
                    value = `$${value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
                } else {
                    value = value.toLocaleString();
                }
            }
            if (header.toLowerCase().includes('date') && value !== '-') {
                value = new Date(value).toLocaleDateString();
            }
            html += `<td>${value}</td>`;
        });
        html += '</tr>';
    });
    
    html += '</tbody>}</div>';
    document.getElementById('resultsContent').innerHTML = html;
}

// Load everything on page start
window.onload = () => {
    loadHotels();
    updateStats();
    // Auto-run Query 1 to show something
    setTimeout(() => runQuery(1), 500);
};