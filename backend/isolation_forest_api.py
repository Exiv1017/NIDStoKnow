from flask import Flask, request, jsonify
import mysql.connector
from mysql.connector import Error
import json
import os
from datetime import datetime

from config import MYSQL_CONFIG as DB_CONFIG
from isolation_forest_runtime import score_command  # New runtime scoring

class IsolationForestDB:
    def __init__(self):
        self.connection = None
    
    def connect(self):
        try:
            self.connection = mysql.connector.connect(**DB_CONFIG)
            return True
        except Error as e:
            print(f"Error connecting to MySQL: {e}")
            return False
    
    def disconnect(self):
        if self.connection and self.connection.is_connected():
            self.connection.close()
    
    def get_model_config(self, model_name='hybrid_detection'):
        """Get Isolation Forest model configuration"""
        try:
            if not self.connect():
                return None
            
            cursor = self.connection.cursor(dictionary=True)
            query = "SELECT * FROM isolation_forest_config WHERE model_name = %s AND is_active = TRUE"
            cursor.execute(query, (model_name,))
            result = cursor.fetchone()
            cursor.close()
            
            return result
        except Error as e:
            print(f"Error getting model config: {e}")
            return None
        finally:
            self.disconnect()
    
    def get_feature_patterns(self, active_only: bool = True):
        """Get feature patterns. By default only active ones.

        Returns list of dict rows with id, pattern_name, pattern_regex, feature_type, boost_value, description, severity, is_active.
        """
        try:
            if not self.connect():
                return []
            cursor = self.connection.cursor(dictionary=True)
            base = (
                "SELECT id, pattern_name, pattern_regex, feature_type, boost_value, "
                "description, severity, is_active FROM anomaly_feature_patterns"
            )
            if active_only:
                base += " WHERE is_active = TRUE"
            base += " ORDER BY feature_type, boost_value DESC"
            cursor.execute(base)
            rows = cursor.fetchall()
            cursor.close()
            return rows
        except Error as e:
            print(f"Error getting feature patterns: {e}")
            return []
        finally:
            self.disconnect()

    def add_feature_pattern(self, pattern_name, pattern_regex, feature_type, boost_value, description=None, severity='Medium', is_active=True):
        """Insert a new anomaly feature pattern. Returns inserted row id or None."""
        try:
            if not self.connect():
                return None
            cursor = self.connection.cursor()
            query = (
                "INSERT INTO anomaly_feature_patterns "
                "(pattern_name, pattern_regex, feature_type, boost_value, description, severity, is_active) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s)"
            )
            cursor.execute(query, (pattern_name, pattern_regex, feature_type, boost_value, description, severity, is_active))
            self.connection.commit()
            new_id = cursor.lastrowid
            cursor.close()
            return new_id
        except Error as e:
            print(f"Error adding feature pattern: {e}")
            return None
        finally:
            self.disconnect()

    def set_feature_pattern_active(self, pattern_id: int, active: bool):
        """Activate or deactivate a feature pattern by id."""
        try:
            if not self.connect():
                return False
            cursor = self.connection.cursor()
            cursor.execute("UPDATE anomaly_feature_patterns SET is_active=%s WHERE id=%s", (active, pattern_id))
            self.connection.commit()
            updated = cursor.rowcount > 0
            cursor.close()
            return updated
        except Error as e:
            print(f"Error updating feature pattern active state: {e}")
            return False
        finally:
            self.disconnect()

    def bulk_add_feature_patterns(self, patterns):
        """Insert multiple patterns. Skips duplicates by (pattern_name, pattern_regex) heuristic.

        patterns: list[dict] with keys pattern_name, pattern_regex, feature_type, boost_value, description?, severity?, is_active?
        Returns counts: {inserted: n, skipped: m}
        """
        if not patterns:
            return {"inserted": 0, "skipped": 0}
        try:
            if not self.connect():
                return {"inserted": 0, "skipped": len(patterns)}
            cursor = self.connection.cursor(dictionary=True)
            # Load existing names+regex to avoid duplicates
            cursor.execute("SELECT pattern_name, pattern_regex FROM anomaly_feature_patterns")
            existing = {(r['pattern_name'], r['pattern_regex']) for r in cursor.fetchall()}
            insert_query = (
                "INSERT INTO anomaly_feature_patterns (pattern_name, pattern_regex, feature_type, boost_value, description, severity, is_active) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s)"
            )
            inserted = 0
            skipped = 0
            for p in patterns:
                key = (p.get('pattern_name'), p.get('pattern_regex'))
                if key in existing:
                    skipped += 1
                    continue
                cursor.execute(insert_query, (
                    p.get('pattern_name'),
                    p.get('pattern_regex'),
                    p.get('feature_type'),
                    p.get('boost_value'),
                    p.get('description'),
                    p.get('severity', 'Medium'),
                    p.get('is_active', True)
                ))
                existing.add(key)
                inserted += 1
            self.connection.commit()
            cursor.close()
            return {"inserted": inserted, "skipped": skipped}
        except Error as e:
            print(f"Error bulk inserting feature patterns: {e}")
            return {"inserted": 0, "skipped": len(patterns)}
        finally:
            self.disconnect()
    
    def get_training_data(self, label=None):
        """Get training data for Isolation Forest"""
        try:
            if not self.connect():
                return []
            
            cursor = self.connection.cursor(dictionary=True)
            if label:
                query = "SELECT * FROM isolation_forest_training_data WHERE label = %s"
                cursor.execute(query, (label,))
            else:
                query = "SELECT * FROM isolation_forest_training_data"
                cursor.execute(query)
            
            results = cursor.fetchall()
            cursor.close()
            
            # Parse JSON fields
            for result in results:
                if result.get('session_context'):
                    result['session_context'] = json.loads(result['session_context'])
                if result.get('feature_vector'):
                    result['feature_vector'] = json.loads(result['feature_vector'])
            
            return results
        except Error as e:
            print(f"Error getting training data: {e}")
            return []
        finally:
            self.disconnect()
    
    def get_boost_config(self, config_name='hybrid_conservative'):
        """Get educational boosting configuration"""
        try:
            if not self.connect():
                return None
            
            cursor = self.connection.cursor(dictionary=True)
            query = "SELECT * FROM anomaly_boost_config WHERE config_name = %s AND is_active = TRUE"
            cursor.execute(query, (config_name,))
            result = cursor.fetchone()
            cursor.close()
            
            return result
        except Error as e:
            print(f"Error getting boost config: {e}")
            return None
        finally:
            self.disconnect()
    
    def add_training_sample(self, command_pattern, label, features, description=None):
        """Add new training sample to the database"""
        try:
            if not self.connect():
                return False
            
            cursor = self.connection.cursor()
            
            # Extract basic features
            command_length = len(command_pattern)
            arg_count = len(command_pattern.split()) - 1
            special_chars_count = sum(1 for c in command_pattern if c in '|&;><')
            path_separators_count = command_pattern.count('/')
            
            # Convert feature vector to JSON
            feature_vector_json = json.dumps(features) if features else None
            
            query = """
                INSERT INTO isolation_forest_training_data 
                (command_pattern, label, command_length, arg_count, special_chars_count, 
                 path_separators_count, feature_vector, description) 
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """
            
            values = (command_pattern, label, command_length, arg_count, 
                     special_chars_count, path_separators_count, 
                     feature_vector_json, description)
            
            cursor.execute(query, values)
            self.connection.commit()
            cursor.close()
            
            return True
        except Error as e:
            print(f"Error adding training sample: {e}")
            return False
        finally:
            self.disconnect()
    
    def update_model_config(self, model_name, **kwargs):
        """Update model configuration"""
        try:
            if not self.connect():
                return False
            
            cursor = self.connection.cursor()
            
            # Build dynamic update query
            update_fields = []
            values = []
            
            for field, value in kwargs.items():
                if field in ['n_trees', 'max_depth', 'contamination', 'sample_size', 'threshold']:
                    update_fields.append(f"{field} = %s")
                    values.append(value)
            
            if not update_fields:
                return False
            
            values.append(model_name)
            query = f"UPDATE isolation_forest_config SET {', '.join(update_fields)} WHERE model_name = %s"
            
            cursor.execute(query, values)
            self.connection.commit()
            cursor.close()
            
            return True
        except Error as e:
            print(f"Error updating model config: {e}")
            return False
        finally:
            self.disconnect()
    
    def get_statistics(self):
        """Get database statistics"""
        try:
            if not self.connect():
                return {}
            
            cursor = self.connection.cursor(dictionary=True)
            
            stats = {}
            
            # Count training samples by label
            cursor.execute("SELECT label, COUNT(*) as count FROM isolation_forest_training_data GROUP BY label")
            training_counts = {row['label']: row['count'] for row in cursor.fetchall()}
            stats['training_data'] = training_counts
            
            # Count feature patterns by type
            cursor.execute("SELECT feature_type, COUNT(*) as count FROM anomaly_feature_patterns WHERE is_active = TRUE GROUP BY feature_type")
            pattern_counts = {row['feature_type']: row['count'] for row in cursor.fetchall()}
            stats['feature_patterns'] = pattern_counts
            
            # Count active configurations
            cursor.execute("SELECT COUNT(*) as count FROM isolation_forest_config WHERE is_active = TRUE")
            stats['active_configs'] = cursor.fetchone()['count']
            
            cursor.close()
            return stats
        except Error as e:
            print(f"Error getting statistics: {e}")
            return {}
        finally:
            self.disconnect()

# Flask app for API endpoints
app = Flask(__name__)
db = IsolationForestDB()

@app.route('/api/isolation-forest/config/<model_name>', methods=['GET'])
def get_model_config(model_name):
    """Get model configuration"""
    config = db.get_model_config(model_name)
    if config:
        return jsonify({'success': True, 'config': config})
    else:
        return jsonify({'success': False, 'error': 'Model configuration not found'}), 404

@app.route('/api/isolation-forest/patterns', methods=['GET'])
def get_feature_patterns():
    """Get feature patterns"""
    patterns = db.get_feature_patterns()
    return jsonify({'success': True, 'patterns': patterns})

@app.route('/api/isolation-forest/training-data', methods=['GET'])
def get_training_data():
    """Get training data"""
    label = request.args.get('label')
    data = db.get_training_data(label)
    return jsonify({'success': True, 'training_data': data})

@app.route('/api/isolation-forest/boost-config/<config_name>', methods=['GET'])
def get_boost_config(config_name):
    """Get boost configuration"""
    config = db.get_boost_config(config_name)
    if config:
        return jsonify({'success': True, 'config': config})
    else:
        return jsonify({'success': False, 'error': 'Boost configuration not found'}), 404

@app.route('/api/isolation-forest/training-data', methods=['POST'])
def add_training_sample():
    """Add new training sample"""
    data = request.json
    success = db.add_training_sample(
        data.get('command_pattern'),
        data.get('label'),
        data.get('features'),
        data.get('description')
    )
    
    if success:
        return jsonify({'success': True, 'message': 'Training sample added successfully'})
    else:
        return jsonify({'success': False, 'error': 'Failed to add training sample'}), 500

@app.route('/api/isolation-forest/config/<model_name>', methods=['PUT'])
def update_model_config(model_name):
    """Update model configuration"""
    data = request.json
    success = db.update_model_config(model_name, **data)
    
    if success:
        return jsonify({'success': True, 'message': 'Model configuration updated successfully'})
    else:
        return jsonify({'success': False, 'error': 'Failed to update model configuration'}), 500

@app.route('/api/isolation-forest/statistics', methods=['GET'])
def get_statistics():
    """Get database statistics"""
    stats = db.get_statistics()
    return jsonify({'success': True, 'statistics': stats})

@app.route('/api/isolation-forest/score', methods=['POST'])
def score():
    """Score a single command pattern with the Isolation Forest hybrid layer.

    Expects JSON: {"command": "..."}
    Returns scoring details including features & any boost pattern matches.
    """
    payload = request.json or {}
    command = payload.get('command') or ''
    try:
        result = score_command(command)
        return jsonify({'success': True, 'result': result})
    except Exception as e:  # Broad catch to avoid crashing API
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5001)
