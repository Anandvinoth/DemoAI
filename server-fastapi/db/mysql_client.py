#import pymysql
import mysql.connector

def get_connection():
    return mysql.connector.connect(
        host="localhost",
        user="sa",
        password="nimda",
        database="openvoice360"
        #cursorclass=pymysql.cursors.DictCursor,
        #autocommit=True
    )
