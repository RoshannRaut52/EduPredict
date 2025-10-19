// Replace the existing script section with this enhanced version:

const backendUrl = 'https://edupredict-l9eg.onrender.com';
let collegeData = null;
let authToken = null;

// Check Authentication and Load Data
async function initializeDashboard() {
  authToken = localStorage.getItem('collegeToken');
  
  if (!authToken) {
    alert('Please login first.');
    window.location.href = '../login/college.html';
    return;
  }
  
  await loadDashboardData();
}

// Load Dashboard Data from Backend
async function loadDashboardData() {
  try {
    const response = await fetch(`${backendUrl}/api/college/dashboard`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        alert('Session expired. Please login again.');
        localStorage.clear();
        window.location.href = '../login/college.html';
        return;
      }
      throw new Error('Failed to load dashboard data');
    }

    collegeData = await response.json();
    
    // Update localStorage
    localStorage.setItem('collegeData', JSON.stringify(collegeData));
    
    // Update UI
    updateDashboardUI();
    
  } catch (error) {
    console.error('Error loading dashboard:', error);
    alert('Failed to load dashboard data. Please try again.');
  }
}

// Update Dashboard UI with Data
function updateDashboardUI() {
  const safeString = val => val && val.trim() !== '' ? val : 'N/A';
  const safeNumber = val => Number.isFinite(val) ? val : 0;
  
  // Update college name
  document.getElementById('collegeName').textContent = safeString(collegeData.name);
  
  // Update chart data
  document.getElementById('totalStudents').textContent = safeNumber(collegeData.total_students);
  document.getElementById('atRiskStudents').textContent = safeNumber(collegeData.at_risk_students);
  document.getElementById('dropoutStudents').textContent = safeNumber(collegeData.dropout_students);
  document.getElementById('savedStudents').textContent = safeNumber(collegeData.saved_students);
  
  // Update notifications
  document.getElementById('toParents').textContent = safeNumber(collegeData.notifications_to_parents);
  document.getElementById('toTeachers').textContent = safeNumber(collegeData.notifications_to_teachers);
  
  // Update summary cards
  document.getElementById('summaryTotalStudents').textContent = safeNumber(collegeData.total_students);
  document.getElementById('summaryAtRiskStudents').textContent = safeNumber(collegeData.at_risk_students);
  document.getElementById('summaryDropoutStudents').textContent = safeNumber(collegeData.dropout_students);
  document.getElementById('summarySavedStudents').textContent = safeNumber(collegeData.saved_students);
  
  // Create/Update Chart
  createStudentChart();
  
  // Load departments dynamically
  loadDepartmentsSection();
}

// Create Student Distribution Chart
function createStudentChart() {
  const ctx = document.getElementById('studentChart').getContext('2d');
  
  // Destroy existing chart if any
  if (window.studentChartInstance) {
    window.studentChartInstance.destroy();
  }
  
  window.studentChartInstance = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: ['Total Students', 'At Risk', 'Dropout', 'Saved'],
      datasets: [{
        data: [
          collegeData.total_students || 0,
          collegeData.at_risk_students || 0,
          collegeData.dropout_students || 0,
          collegeData.saved_students || 0,
        ],
        backgroundColor: ['#2e86de', '#ee5253', '#ff9f43', '#10ac84'],
        borderWidth: 1,
        borderColor: '#fff',
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true, mode: 'nearest' }
      },
      animation: { duration: 1000, easing: 'easeOutQuart' },
    }
  });
}

// Load Departments Section Dynamically
async function loadDepartmentsSection() {
  try {
    const response = await fetch(`${backendUrl}/api/college/${collegeData.id}/departments`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      renderDepartmentsList(data.departments || []);
    }
  } catch (error) {
    console.error('Error loading departments:', error);
  }
}

// Render Departments List
function renderDepartmentsList(departments) {
  const departmentsSection = document.querySelector('.departments');
  
  if (!departmentsSection) return;
  
  // Clear existing departments (except title)
  const existingDepts = departmentsSection.querySelectorAll('.department, .year-list');
  existingDepts.forEach(el => el.remove());
  
  departments.forEach(dept => {
    const deptDiv = document.createElement('div');
    deptDiv.className = 'department';
    deptDiv.setAttribute('tabindex', '0');
    deptDiv.setAttribute('role', 'button');
    deptDiv.setAttribute('aria-expanded', 'false');
    deptDiv.setAttribute('aria-controls', dept.id);
    deptDiv.innerHTML = `💼 ${dept.name} <span aria-hidden="true">▼</span>`;
    deptDiv.onclick = () => toggleYears(dept.id);
    
    departmentsSection.appendChild(deptDiv);
    
    const yearList = document.createElement('div');
    yearList.className = 'year-list';
    yearList.id = dept.id;
    yearList.setAttribute('aria-hidden', 'true');
    yearList.setAttribute('role', 'region');
    
    ['1st Year', '2nd Year', '3rd Year', '4th Year'].forEach(year => {
      const link = document.createElement('a');
      link.href = `../student1.html?dept=${dept.id}&year=${year}`;
      link.title = `${year} ${dept.name}`;
      link.textContent = year;
      yearList.appendChild(link);
    });
    
    departmentsSection.appendChild(yearList);
  });
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', initializeDashboard);

// Auto-refresh data every 5 minutes
setInterval(loadDashboardData, 300000);
