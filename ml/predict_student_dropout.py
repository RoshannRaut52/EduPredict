#!/usr/bin/env python3
"""
Student Dropout Risk Prediction Script
This script loads the trained model and makes predictions on new student data
"""

import pandas as pd
import numpy as np
import pickle
import warnings
warnings.filterwarnings('ignore')

def load_model_components():
    """Load all saved model components"""
    with open('dropout_prediction_model.pkl', 'rb') as f:
        model = pickle.load(f)

    with open('scaler.pkl', 'rb') as f:
        scaler = pickle.load(f)

    with open('label_encoders.pkl', 'rb') as f:
        label_encoders = pickle.load(f)

    with open('feature_columns.pkl', 'rb') as f:
        feature_columns = pickle.load(f)

    return model, scaler, label_encoders, feature_columns

def preprocess_input(student_data, label_encoders, feature_columns):
    """Preprocess input data for prediction"""
    # Create DataFrame
    df = pd.DataFrame([student_data])

    # Select only the features used during training
    df = df[feature_columns]

    # Encode categorical variables
    for col in label_encoders.keys():
        if col in df.columns:
            try:
                df[col] = label_encoders[col].transform(df[col].astype(str))
            except ValueError:
                # If unknown category, use the most frequent one
                df[col] = 0

    return df

def predict_dropout_risk(student_data):
    """
    Predict dropout risk for a student

    Parameters:
    -----------
    student_data : dict
        Dictionary containing student information

    Returns:
    --------
    dict : Prediction results including risk category and probabilities
    """
    # Load model components
    model, scaler, label_encoders, feature_columns = load_model_components()

    # Preprocess input
    X = preprocess_input(student_data, label_encoders, feature_columns)

    # Scale features
    X_scaled = scaler.transform(X)

    # Make prediction
    prediction = model.predict(X_scaled)[0]
    probabilities = model.predict_proba(X_scaled)[0]

    # Get class labels
    classes = model.classes_

    # Create results dictionary
    results = {
        'Dropout_Risk': prediction,
        'Confidence': max(probabilities) * 100,
        'Probabilities': {
            class_name: prob * 100 
            for class_name, prob in zip(classes, probabilities)
        }
    }

    return results

def print_prediction_results(results, student_info=None):
    """Pretty print prediction results"""
    print("\n" + "=" * 80)
    print("STUDENT DROPOUT RISK PREDICTION")
    print("=" * 80)

    if student_info:
        print(f"\nStudent Information:")
        print(f"  Roll No: {student_info.get('Roll No', 'N/A')}")
        print(f"  Gender: {student_info.get('Gender', 'N/A')}")
        print(f"  Age: {student_info.get('Age', 'N/A')}")
        print(f"  Final Grade: {student_info.get('Final_Grade', 'N/A')}")

    print(f"\n" + "-" * 80)
    print(f"PREDICTION: {results['Dropout_Risk'].upper()} RISK")
    print(f"Confidence: {results['Confidence']:.2f}%")
    print("-" * 80)

    print(f"\nDetailed Probabilities:")
    for risk_level, prob in sorted(results['Probabilities'].items()):
        bar = "█" * int(prob / 2)
        print(f"  {risk_level:8s} : {prob:5.2f}% {bar}")

    print("\n" + "=" * 80)

    # Recommendation
    if results['Dropout_Risk'] == 'High':
        print("⚠️  RECOMMENDATION: Immediate intervention required!")
        print("   - Schedule meeting with student and parents")
        print("   - Provide academic support and counseling")
        print("   - Monitor attendance and performance closely")
    elif results['Dropout_Risk'] == 'Medium':
        print("⚡ RECOMMENDATION: Monitor and provide support")
        print("   - Regular check-ins with student")
        print("   - Encourage participation in support programs")
        print("   - Address any emerging issues early")
    else:
        print("✓  RECOMMENDATION: Continue current support")
        print("   - Maintain regular monitoring")
        print("   - Encourage continued good performance")

    print("=" * 80 + "\n")

# Example usage
if __name__ == "__main__":
    # Example student data (you can modify this)
    example_student = {
        'Gender': 'F',
        'Age': 17.0,
        'Address': 'U',
        'Family_Size': 'GT3',
        'Parental_Status': 'A',
        'Mother_Education': 3.0,
        'Father_Education': 3.0,
        'Mother_Job': 'teacher',
        'Father_Job': 'services',
        'Reason_for_Choosing_School': 'reputation',
        'Guardian': 'mother',
        'Travel_Time': 2.0,
        'Study_Time': 2.0,
        'Number_of_Failures': 0.0,
        'School_Support': 'yes',
        'Family_Support': 'yes',
        'Extra_Paid_Class': 'no',
        'Extra_Curricular_Activities': 'yes',
        'Attended_Nursery': 'yes',
        'Wants_Higher_Education': 'yes',
        'Internet_Access': 'yes',
        'Family_Relationship': 4.0,
        'Free_Time': 3.0,
        'Health_Status': 3.0,
        'Number_of_Absences': 2.0,
        'Grade_1': 65.0,
        'Grade_2': 70.0,
        'Final_Grade': 14.0
    }

    # Make prediction
    results = predict_dropout_risk(example_student)

    # Print results
    print_prediction_results(results, example_student)

    print("\n" + "=" * 80)
    print("To predict for a new student, modify the 'example_student' dictionary")
    print("or call predict_dropout_risk() with your own student data dictionary")
    print("=" * 80)
