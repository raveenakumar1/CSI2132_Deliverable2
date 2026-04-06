import psycopg2
import psycopg2.extras

def connect():
    return psycopg2.connect(
        host="localhost",
        database="ehotels",
        user="postgres",
        password="postgres",
        cursor_factory=psycopg2.extras.RealDictCursor
    )