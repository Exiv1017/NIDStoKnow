"""Centralized MySQL configuration.

Environment variables (optional):
  DB_HOST (default: localhost)
  DB_USER (default: hanz)
  DB_PASSWORD (default: 0222-1754chepol)
  DB_NAME (default: nids_to_know)

Set DB_NAME=exustunh (and create that database) to redirect all persistence there.
"""
import os
import mysql.connector

MYSQL_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'user': os.getenv('DB_USER', 'hanz'),
    'password': os.getenv('DB_PASSWORD', '0222-1754chepol'),
    'database': os.getenv('DB_NAME', 'nids_to_know')
}

def get_db_connection():
    return mysql.connector.connect(**MYSQL_CONFIG)

# Development mode flag: when True, some endpoints may return softer behavior
# (e.g., allow missing auth by returning empty results). Default is False.
DEV_MODE = os.getenv('DEV_MODE', 'false').lower() in ('1', 'true', 'yes')
