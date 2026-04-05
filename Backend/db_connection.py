import psycopg2
import psycopg2.extras

def connect():
    return psycopg2.connect(
        host="localhost",
        database="your_db_name",
        user="your_username",
        password="your_password",
        cursor_factory=psycopg2.extras.RealDictCursor
    )