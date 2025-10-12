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
      window.location.href = 'collegehomepage.html';
    } else {
      errorMsg.textContent = data.error || 'Login failed';
    }
  } catch (error) {
    console.error('College login error:', error);
    errorMsg.textContent = 'Error connecting to server.';
  }
});

// ==============================
// 🔹 Student Login
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
      // ✅ Save complete student info for dashboard
      const studentData = {
        name: data.student.name || "Student",
        email: data.student.email,
        department: data.student.department || "N/A",
        year: data.student.year || "N/A",
        rollno: data.student.rollno || "N/A",
        academicStatus: data.student.academicStatus || "Good Standing",
        attendance: data.student.attendance || "85%",
        prediction: data.student.prediction || "Likely to Graduate"
      };

      localStorage.setItem('studentData', JSON.stringify(studentData));

      window.location.href = 'studenthomepage.html'; // ✅ Redirect to dashboard
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
      window.location.href = 'studentlogin.html';
    } else {
      errorMsg.textContent = data.message || 'Registration failed';
    }
  } catch (error) {
    console.error('Student registration error:', error);
    errorMsg.textContent = 'Error connecting to server.';
  }
});
