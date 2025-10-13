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
