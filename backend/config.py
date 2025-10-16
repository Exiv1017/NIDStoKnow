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
from functools import lru_cache
from typing import Dict, Any

MYSQL_CONFIG = {
  'host': os.getenv('DB_HOST', 'mysql'),
    'user': os.getenv('DB_USER', 'hanz'),
    'password': os.getenv('DB_PASSWORD', '0222-1754chepol'),
    'database': os.getenv('DB_NAME', 'nids_to_know')
}

def get_db_connection():
    return mysql.connector.connect(**MYSQL_CONFIG)

# Development mode flag: when True, some endpoints may return softer behavior
# (e.g., allow missing auth by returning empty results). Default is False.
DEV_MODE = os.getenv('DEV_MODE', 'false').lower() in ('1', 'true', 'yes')

# Cached settings fetcher for admin system settings
@lru_cache(maxsize=1)
def get_admin_system_settings_cached() -> Dict[str, Any]:
  try:
    conn = get_db_connection(); cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM admin_system_settings LIMIT 1")
    row = cursor.fetchone() or {}
    cursor.close(); conn.close()
    if not row:
      return {
        'enableUserRegistration': True,
        'autoApproveInstructors': False,
        'maintenanceMode': False,
        'backupFrequency': 'daily',
        'sessionTimeoutMinutes': 60,
        'requireStrongPasswords': True,
        'allowInstructorBulkActions': True,
      }
    # Normalize booleans
    def b(v, d=False):
      try:
        return bool(int(v))
      except Exception:
        return bool(v) if v is not None else d
    return {
      'enableUserRegistration': b(row.get('enableUserRegistration'), True),
      'autoApproveInstructors': b(row.get('autoApproveInstructors'), False),
      'maintenanceMode': b(row.get('maintenanceMode'), False),
      'backupFrequency': row.get('backupFrequency') or 'daily',
      'sessionTimeoutMinutes': int(row.get('sessionTimeoutMinutes') or 60),
      'requireStrongPasswords': b(row.get('requireStrongPasswords'), True),
      'allowInstructorBulkActions': b(row.get('allowInstructorBulkActions'), True),
    }
  except Exception:
    # On failure, fall back to defaults
    return {
      'enableUserRegistration': True,
      'autoApproveInstructors': False,
      'maintenanceMode': False,
      'backupFrequency': 'daily',
      'sessionTimeoutMinutes': 60,
      'requireStrongPasswords': True,
      'allowInstructorBulkActions': True,
    }

def invalidate_admin_system_settings_cache():
  try:
    get_admin_system_settings_cached.cache_clear()
  except Exception:
    pass
