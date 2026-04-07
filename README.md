# CSI2132 Database Project

## Setup

1. Install Python packages: `pip install -r backend/requirements.txt`
2. Download PostgreSQL: https://www.postgresql.org/download/ (next-next-finish)
3. Open pgAdmin (installed with PostgreSQL) and click "Servers" > "PostgreSQL" > enter password (password you set up during installation)
4. Right click "Databases" > "Create" > "Database" > name it `ehotels`
5. Right-click ehotels > "Query Tool"
6. Copy and paste ALL the SQL from the `Table` file under the `Database` folder into the `Query Tool`, then click "Run" (the play button)
7. Copy and paste ALL the SQL from the `Database_Population` file under the `Database` folder into the `Query Tool`, then click "Run" 
8. Copy and paste ALL the SQL from the `Indexes` file, `Triggers` file, and `Views` file under the `Database` folder into the `Query Tool`, then click "Run" 
9. Go to app.py OR db_connections.py and fill in your database credentials where it says so 
10. Run: `python backend/app.py`
11. Open browser to `http://localhost:5000`

## Files
- `database/` - All SQL files (tables, queries, triggers, views, indexes)
- `backend/` - Python Flask server
- `frontend/` - HTML/CSS/JS UI
