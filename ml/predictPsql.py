#!/usr/bin/env python3
"""
EduPredict - PostgreSQL Student Dropout Risk Prediction Script
Connects to Render PostgreSQL database and adds predictions automatically
"""

import pandas as pd
import numpy as np
import pickle
import psycopg2
from psycopg2 import sql
import warnings
import os
from datetime import datetime
warnings.filterwarnings('ignore')

# ============================================================================
# CONFIGURE YOUR DATABASE DETAILS HERE
# ============================================================================

DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'dpg-d3imcvadbo4c73fsi8rg-a.oregon-postgres.render.com'),
    'port': int(os.getenv('DB_PORT', 5432)),
    'database': os.getenv('DB_NAME', 'database_8suu'),
    'user': os.getenv('DB_USER', 'database_8suu_user'),
    'password': os.getenv('DB_PASSWORD', 'JhWakO3g5BhqleKSRSd87yFw3tOpf5xF')
}

TABLE_NAME = 'students'

# ============================================================================

def load_model_components():
    """Load all saved model components"""
    print("Loading model components...")
    
    try:
        with open('dropout_prediction_model.pkl', 'rb') as f:
            model = pickle.load(f)
        
        with open('scaler.pkl', 'rb') as f:
            scaler = pickle.load(f)
        
        with open('label_encoders.pkl', 'rb') as f:
            label_encoders = pickle.load(f)
        
        with open('feature_columns.pkl', 'rb') as f:
            feature_columns = pickle.load(f)
        
        print("✓ Model loaded successfully")
        return model, scaler, label_encoders, feature_columns
    
    except FileNotFoundError as e:
        print(f"❌ Error: Model files not found. Please ensure all .pkl files are in the same directory.")
        print(f"   Missing file: {e.filename}")
        return None, None, None, None

def get_recommendation(risk_level):
    """Get recommendation text based on risk level"""
    recommendations = {
        'High': 'Immediate intervention required - Schedule meeting with parents, provide counseling, monitor daily attendance and performance',
        'Medium': 'Monitor closely and provide support - Regular check-ins, encourage participation in support programs, address issues proactively',
        'Low': 'Continue current support - Maintain regular monitoring, encourage continued good performance, recognize achievements'
    }
    return recommendations.get(risk_level, 'No recommendation available')

def connect_to_database():
    """Connect to PostgreSQL database on Render"""
    try:
        print(f"\nConnecting to Render PostgreSQL database: {DB_CONFIG['database']}...")
        conn = psycopg2.connect(
            host=DB_CONFIG['host'],
            port=DB_CONFIG['port'],
            database=DB_CONFIG['database'],
            user=DB_CONFIG['user'],
            password=DB_CONFIG['password'],
            sslmode='require'  # Required for Render PostgreSQL
        )
        print("✓ Connected successfully to Render database")
        return conn
    except psycopg2.Error as e:
        print(f"❌ Error connecting to database: {e}")
        print("\nTroubleshooting tips:")
        print("  1. Check that your database credentials are correct")
        print("  2. Ensure your IP is whitelisted in Render (or use internal connection)")
        print("  3. Verify the database is running")
        return None

def add_prediction_columns(conn):
    """Add prediction columns to the table if they don't exist"""
    cursor = conn.cursor()
    
    columns_to_add = [
        ('prediction', 'VARCHAR(10)'),
        ('confidence', 'DECIMAL(5,2)'),
        ('probability_high', 'DECIMAL(5,2)'),
        ('probability_low', 'DECIMAL(5,2)'),
        ('probability_medium', 'DECIMAL(5,2)'),
        ('recommendation', 'TEXT'),
        ('predicted_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
    ]
    
    print("\nChecking/adding prediction columns to table...")
    
    for col_name, col_type in columns_to_add:
        try:
            cursor.execute(f"""
                ALTER TABLE {TABLE_NAME} 
                ADD COLUMN IF NOT EXISTS {col_name} {col_type}
            """)
            conn.commit()
            print(f"  ✓ Column '{col_name}' ready")
        except psycopg2.Error as e:
            print(f"  ⚠ Warning for column '{col_name}': {e}")
            conn.rollback()
    
    cursor.close()

def fetch_students_from_db(conn):
    """Fetch all student records from PostgreSQL"""
    print(f"\nFetching student data from table '{TABLE_NAME}'...")
    
    query = f"SELECT * FROM {TABLE_NAME}"
    
    try:
        df = pd.read_sql_query(query, conn)
        print(f"✓ Fetched {len(df)} student records from database")
        return df
    except Exception as e:
        print(f"❌ Error fetching data: {e}")
        return None

def make_predictions(df, model, scaler, label_encoders, feature_columns):
    """Make predictions for all students"""
    print("\nMaking predictions...")
    print(f"  Required features: {feature_columns}")
    
    # Check if all required columns exist
    missing_cols = [col for col in feature_columns if col not in df.columns]
    if missing_cols:
        print(f"❌ Error: Missing columns in database: {missing_cols}")
        print(f"   Available columns: {list(df.columns)}")
        return None
    
    # Remove rows with missing values
    df_clean = df.dropna(subset=feature_columns)
    skipped = len(df) - len(df_clean)
    if skipped > 0:
        print(f"  ⚠ Skipped {skipped} records with missing data")
    print(f"  Processing {len(df_clean)} valid records")
    
    # Prepare features
    feature_df = df_clean[feature_columns].copy()
    
    # Encode categorical variables
    for col in label_encoders.keys():
        if col in feature_df.columns:
            try:
                feature_df[col] = label_encoders[col].transform(feature_df[col].astype(str))
            except Exception as e:
                print(f"  ⚠ Warning encoding column '{col}': {e}")
                feature_df[col] = 0
    
    # Scale features
    X_scaled = scaler.transform(feature_df)
    
    # Make predictions
    predictions = model.predict(X_scaled)
    probabilities = model.predict_proba(X_scaled)
    
    # Get confidence
    confidence = np.max(probabilities, axis=1) * 100
    
    # Get individual probabilities
    classes = model.classes_
    prob_high = probabilities[:, list(classes).index('High')] * 100
    prob_low = probabilities[:, list(classes).index('Low')] * 100
    prob_medium = probabilities[:, list(classes).index('Medium')] * 100
    
    # Add predictions to dataframe
    df_clean = df_clean.copy()
    df_clean['prediction'] = predictions
    df_clean['confidence'] = confidence.round(2)
    df_clean['probability_high'] = prob_high.round(2)
    df_clean['probability_low'] = prob_low.round(2)
    df_clean['probability_medium'] = prob_medium.round(2)
    df_clean['recommendation'] = df_clean['prediction'].apply(get_recommendation)
    df_clean['predicted_at'] = datetime.now()
    
    print("✓ Predictions completed successfully")
    return df_clean

def update_database(conn, df_predictions):
    """Update PostgreSQL database with predictions"""
    print("\nUpdating database with predictions...")
    
    cursor = conn.cursor()
    
    # Try to find the ID column
    id_column = None
    for col in ['id', 'student_id', 'roll_no', 'Roll No', 'rollno', 'Roll_No']:
        if col in df_predictions.columns:
            id_column = col
            break
    
    if not id_column:
        print("❌ Could not find ID column. Available columns:", list(df_predictions.columns))
        return
    
    print(f"  Using '{id_column}' as primary key")
    
    update_count = 0
    error_count = 0
    
    for idx, row in df_predictions.iterrows():
        try:
            update_query = sql.SQL("""
                UPDATE {table}
                SET prediction = %s,
                    confidence = %s,
                    probability_high = %s,
                    probability_low = %s,
                    probability_medium = %s,
                    recommendation = %s,
                    predicted_at = %s
                WHERE {id_col} = %s
            """).format(
                table=sql.Identifier(TABLE_NAME),
                id_col=sql.Identifier(id_column)
            )
            
            cursor.execute(update_query, (
                row['prediction'],
                float(row['confidence']),
                float(row['probability_high']),
                float(row['probability_low']),
                float(row['probability_medium']),
                row['recommendation'],
                row['predicted_at'],
                row[id_column]
            ))
            
            update_count += 1
            
            if update_count % 50 == 0:
                print(f"  Updated {update_count}/{len(df_predictions)} records...")
        
        except Exception as e:
            error_count += 1
            if error_count <= 5:  # Only show first 5 errors
                print(f"  ⚠ Error updating record {row.get(id_column)}: {e}")
            continue
    
    conn.commit()
    cursor.close()
    
    print(f"✓ Successfully updated {update_count} records in database")
    if error_count > 0:
        print(f"  ⚠ {error_count} records failed to update")

def print_summary(df_predictions):
    """Print prediction summary"""
    print("\n" + "="*80)
    print("EDUPREDICT - DROPOUT RISK PREDICTION SUMMARY")
    print("="*80)
    
    prediction_counts = df_predictions['prediction'].value_counts()
    total = len(df_predictions)
    
    print(f"\nTotal students processed: {total}")
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("\nRisk Distribution:")
    for risk_level in ['Low', 'Medium', 'High']:
        if risk_level in prediction_counts.index:
            count = prediction_counts[risk_level]
            percentage = (count / total) * 100
            bar = "█" * int(percentage / 2)
            print(f"  {risk_level:8s}: {count:4d} ({percentage:5.2f}%) {bar}")
    
    # High risk students
    high_risk = df_predictions[df_predictions['prediction'] == 'High']
    if len(high_risk) > 0:
        print(f"\n⚠️  {len(high_risk)} students are at HIGH RISK!")
        print(f"   Immediate attention required for these students.")
        print(f"   Average confidence: {high_risk['confidence'].mean():.2f}%")
    
    # Medium risk students
    medium_risk = df_predictions[df_predictions['prediction'] == 'Medium']
    if len(medium_risk) > 0:
        print(f"\n📊 {len(medium_risk)} students at MEDIUM RISK")
        print(f"   Monitor closely and provide support")

def main():
    """Main execution function"""
    print("="*80)
    print("EDUPREDICT - POSTGRESQL STUDENT DROPOUT RISK PREDICTION")
    print("="*80)
    
    # Load model
    model, scaler, label_encoders, feature_columns = load_model_components()
    if model is None:
        return
    
    # Connect to database
    conn = connect_to_database()
    if not conn:
        return
    
    try:
        # Add prediction columns if they don't exist
        add_prediction_columns(conn)
        
        # Fetch student data
        df = fetch_students_from_db(conn)
        if df is None or len(df) == 0:
            print("❌ No student data found in database")
            return
        
        # Make predictions
        df_predictions = make_predictions(df, model, scaler, label_encoders, feature_columns)
        if df_predictions is None or len(df_predictions) == 0:
            print("❌ No valid predictions generated")
            return
        
        # Update database
        update_database(conn, df_predictions)
        
        # Print summary
        print_summary(df_predictions)
        
        # Save backup
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_file = f'predictions_backup_{timestamp}.csv'
        df_predictions.to_csv(backup_file, index=False)
        print(f"\n📁 Backup saved to: {backup_file}")
        
        print("\n" + "="*80)
        print("✅ DATABASE UPDATE COMPLETE!")
        print("="*80)
        print("""
Your PostgreSQL table now has these prediction columns:
  • prediction          (Low/Medium/High)
  • confidence          (percentage)
  • probability_high    (percentage)
  • probability_low     (percentage)
  • probability_medium  (percentage)
  • recommendation      (action text)
  • predicted_at        (timestamp)

Query examples:
  SELECT * FROM students WHERE prediction = 'High' ORDER BY confidence DESC;
  SELECT * FROM students WHERE probability_high > 70;
  SELECT prediction, COUNT(*) FROM students GROUP BY prediction;
        """)
    
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        if conn:
            conn.close()
            print("\n✓ Database connection closed")

if __name__ == "__main__":
    main()
