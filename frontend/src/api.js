// src/auth.js
const backendUrl = 'https://edupredict-l9eg.onrender.com';



// ==============================
// 🔹 College Login
// ==============================
document.getElementById('collegeLoginForm')?.addEventListener('submit', async function(e) {
  e.preventDefault();

  const code = document.getElementById('collegeCode').value.trim();
  const email = document.getElementById('collegeEmail').value.trim();
  const password = document.getElementById('collegePassword').value;
  const errorMsg = document.getElementById('collegeErrorMessage');
  errorMsg.textContent = '';

  try {
    const res = await fetch(`${backendUrl}/api/college/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, email, password })
    });

    const data = await res.json();

    if (res.ok) {
      localStorage.setItem('collegeData', JSON.stringify(data));
      window.location.href = 'college.html';
    } else {
      errorMsg.textContent = data.error || 'Login failed';
    }
  } catch (error) {
    console.error('College login error:', error);
    errorMsg.textContent = 'Error connecting to server.';
  }
});



// ==============================
// 🔹 Student Login - ENHANCED FOR DASHBOARD
// ==============================
document.getElementById('studentLoginForm')?.addEventListener('submit', async function(e) {
  e.preventDefault();

  const email = document.getElementById('studentEmail').value.trim();
  const password = document.getElementById('studentPassword').value;
  const errorMsg = document.getElementById('studentErrorMessage');
  errorMsg.textContent = '';

  try {
    const res = await fetch(`${backendUrl}/login/student`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (res.ok) {
      // ✅ Save complete student info for dashboard with all required fields
      const studentData = {
        id: data.student.id,
        name: data.student.name || "Student",
        email: data.student.email,
        college: data.student.college_name || data.student.college || "College Name",
        department: data.student.department || "N/A",
        year: data.student.year || "N/A",
        rollno: data.student.rollno || "N/A",
        rollNo: data.student.rollno || "N/A", // Alternative naming
        attendance: data.student.attendance || "85%",
        cgpa: data.student.cgpa || "N/A",
        assignmentsSubmitted: data.student.assignments_submitted || data.student.assignmentsSubmitted || "0",
        achievementsCount: data.student.achievements?.length || "3",
        academicStatus: data.student.academicStatus || "Good Standing",
        prediction: data.student.dropout_prediction || data.student.prediction || "Low Dropout Risk - Excellent Performance!",
        
        // Additional dashboard data
        achievements: data.student.achievements || [
          "Top Performer",
          "100% Attendance", 
          "Math Olympiad Winner"
        ],
        collegeNews: data.student.collegeNews || [
          "Orientation Day next Monday",
          "Seminar: AI & Education on Oct 18",
          "New Library Resources Available"
        ],
        upcomingEvents: data.student.upcomingEvents || [
          "Cultural Fest - Oct 25-27",
          "Sports Week - Nov 3-7",
          "Tech Symposium - Nov 15"
        ],
        importantNotices: data.student.importantNotices || [
          "Exam forms due Oct 20",
          "Library closed on Sunday",
          "Fee payment deadline: Oct 30"
        ],
        profilePic: data.student.profilePic || null
      };

      localStorage.setItem('studentData', JSON.stringify(studentData));

      window.location.href = 'student.html'; // ✅ Redirect to dashboard
    } else {
      errorMsg.textContent = data.message || 'Login failed';
    }
  } catch (error) {
    console.error('Student login error:', error);
    errorMsg.textContent = 'Error connecting to server.';
  }
});



// ==============================
// 🔹 Student Registration
// ==============================
document.getElementById('studentRegisterForm')?.addEventListener('submit', async function(e) {
  e.preventDefault();

  const name = document.getElementById('studentName').value.trim();
  const email = document.getElementById('studentRegEmail').value.trim();
  const contact = document.getElementById('studentContact').value.trim();
  const college_code = document.getElementById('studentCollegeCode').value.trim();
  const course = document.getElementById('studentCourse').value.trim();
  const password = document.getElementById('studentRegPassword').value;
  const confirm_password = document.getElementById('studentConfirmPassword').value;
  const errorMsg = document.getElementById('studentRegErrorMessage');
  errorMsg.textContent = '';

  try {
    const res = await fetch(`${backendUrl}/register/student`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, email, contact, college_code, course, password, confirm_password
      })
    });

    const data = await res.json();

    if (res.ok) {
      alert('✅ Registration successful! You can now login.');
      window.location.href = 'student.html';
    } else {
      errorMsg.textContent = data.message || 'Registration failed';
    }
  } catch (error) {
    console.error('Student registration error:', error);
    errorMsg.textContent = 'Error connecting to server.';
  }
});



// ==============================
// 🔹 Parent Registration (NEW)
// ==============================
document.getElementById('parentRegisterForm')?.addEventListener('submit', async function(e) {
  e.preventDefault();

  const name = document.getElementById('parentName').value.trim();
  const email = document.getElementById('parentRegEmail').value.trim();
  const phone = document.getElementById('parentPhone').value.trim();
  const student_email = document.getElementById('parentStudentEmail').value.trim();
  const relationship = document.getElementById('parentRelationship').value.trim();
  const password = document.getElementById('parentRegPassword').value;
  const confirm_password = document.getElementById('parentConfirmPassword').value;
  const errorMsg = document.getElementById('parentRegErrorMessage');
  errorMsg.textContent = '';

  try {
    const res = await fetch(`${backendUrl}/register/parent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, email, phone, student_email, relationship, password, confirm_password
      })
    });

    const data = await res.json();

    if (res.ok) {
      alert('✅ Parent registration successful! You can now login.');
      window.location.href = 'parent.html';
    } else {
      errorMsg.textContent = data.message || 'Registration failed';
    }
  } catch (error) {
    console.error('Parent registration error:', error);
    errorMsg.textContent = 'Error connecting to server.';
  }
});



// ==============================
// 🔹 Parent Login (NEW)
// ==============================
document.getElementById('parentLoginForm')?.addEventListener('submit', async function(e) {
  e.preventDefault();

  const email = document.getElementById('parentEmail').value.trim();
  const password = document.getElementById('parentPassword').value;
  const errorMsg = document.getElementById('parentErrorMessage');
  errorMsg.textContent = '';

  try {
    const res = await fetch(`${backendUrl}/login/parent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (res.ok) {
      // ✅ Save parent info for dashboard
      const parentData = {
        name: data.parent.name || "Parent",
        email: data.parent.email,
        phone: data.parent.phone || "N/A",
        relationship: data.parent.relationship || "Guardian",
        student_name: data.parent.student_name || "N/A"
      };

      localStorage.setItem('parent', JSON.stringify(parentData));

      window.location.href = 'parent.html'; // ✅ Redirect to parent dashboard
    } else {
      errorMsg.textContent = data.message || 'Login failed';
    }
  } catch (error) {
    console.error('Parent login error:', error);
    errorMsg.textContent = 'Error connecting to server.';
  }
});


// ==============================
// 🎯 NEW: FETCH STUDENT DASHBOARD DATA (OPTIONAL - FOR DYNAMIC UPDATES)
// ==============================
/**
 * Fetches complete student dashboard data from backend
 * Can be called after login or on dashboard page load
 */
async function fetchStudentDashboardData(studentId) {
  try {
    const res = await fetch(`${backendUrl}/api/student/dashboard/${studentId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await res.json();

    if (res.ok) {
      // Update localStorage with fresh data
      const existingData = JSON.parse(localStorage.getItem('studentData')) || {};
      
      const updatedStudentData = {
        ...existingData,
        id: data.id,
        name: data.name || existingData.name || "Student",
        email: data.email || existingData.email,
        college: data.college || data.college_name || existingData.college || "College Name",
        department: data.department || existingData.department || "N/A",
        year: data.year || existingData.year || "N/A",
        rollno: data.rollno || data.rollNo || existingData.rollno || "N/A",
        rollNo: data.rollno || data.rollNo || existingData.rollNo || "N/A",
        attendance: data.attendance || existingData.attendance || "85%",
        cgpa: data.cgpa || existingData.cgpa || "N/A",
        assignmentsSubmitted: data.assignments_submitted || data.assignmentsSubmitted || existingData.assignmentsSubmitted || "0",
        achievementsCount: data.achievements?.length || existingData.achievementsCount || "3",
        prediction: data.dropout_prediction || data.prediction || existingData.prediction || "Low Dropout Risk",
        achievements: data.achievements || existingData.achievements || ["Top Performer"],
        collegeNews: data.collegeNews || existingData.collegeNews || ["No news available"],
        upcomingEvents: data.upcomingEvents || existingData.upcomingEvents || ["No events scheduled"],
        importantNotices: data.importantNotices || existingData.importantNotices || ["No notices"],
        profilePic: data.profilePic || existingData.profilePic || null
      };

      localStorage.setItem('studentData', JSON.stringify(updatedStudentData));
      return updatedStudentData;
    } else {
      console.error('Failed to fetch dashboard data:', data.message);
      return null;
    }
  } catch (error) {
    console.error('Dashboard fetch error:', error);
    return null;
  }
}


// ==============================
// 🎯 NEW: UPDATE STUDENT PROFILE
// ==============================
/**
 * Updates student profile information
 */
async function updateStudentProfile(studentId, updates) {
  try {
    const res = await fetch(`${backendUrl}/api/student/profile/${studentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });

    const data = await res.json();

    if (res.ok) {
      // Update localStorage with new data
      const existingData = JSON.parse(localStorage.getItem('studentData')) || {};
      const updatedData = { ...existingData, ...data.student };
      localStorage.setItem('studentData', JSON.stringify(updatedData));
      
      return { success: true, data: data.student };
    } else {
      return { success: false, message: data.message };
    }
  } catch (error) {
    console.error('Profile update error:', error);
    return { success: false, message: 'Error connecting to server.' };
  }
}


// ==============================
// 🎯 NEW: GET STUDENT ACADEMIC DATA
// ==============================
/**
 * Fetches student academic performance data
 */
async function getStudentAcademics(studentId) {
  try {
    const res = await fetch(`${backendUrl}/api/student/academics/${studentId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await res.json();

    if (res.ok) {
      return { success: true, data };
    } else {
      return { success: false, message: data.message };
    }
  } catch (error) {
    console.error('Academics fetch error:', error);
    return { success: false, message: 'Error connecting to server.' };
  }
}


// ==============================
// 🎯 NEW: REFRESH DASHBOARD DATA
// ==============================
/**
 * Call this function on dashboard page load to refresh data
 * Usage: Add this to your student dashboard HTML page
 */
window.addEventListener('DOMContentLoaded', async function() {
  // Only run on student dashboard page
  if (window.location.pathname.includes('student.html') || 
      window.location.pathname.includes('dashboard')) {
    
    const studentData = JSON.parse(localStorage.getItem('studentData'));
    
    if (studentData && studentData.id) {
      // Fetch fresh data from backend
      const freshData = await fetchStudentDashboardData(studentData.id);
      
      if (freshData) {
        console.log('✅ Dashboard data refreshed from backend');
        // Trigger a custom event to notify dashboard to reload
        window.dispatchEvent(new CustomEvent('dashboardDataUpdated', { detail: freshData }));
      } else {
        console.log('ℹ️ Using cached dashboard data');
      }
    }
  }
});


// ==============================
// 🎯 EXPORT FUNCTIONS FOR USE IN OTHER FILES
// ==============================
// Make these functions globally available
window.fetchStudentDashboardData = fetchStudentDashboardData;
window.updateStudentProfile = updateStudentProfile;
window.getStudentAcademics = getStudentAcademics;
