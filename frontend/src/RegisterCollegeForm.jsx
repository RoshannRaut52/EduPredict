import React, { useState } from "react";

function RegisterCollegeForm() {
  const [formValues, setFormValues] = useState({
    name: "",
    code: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    email: "",
    phone: "",
    principal_name: "",
    college_type: "",
    category: "",
    aided: "",
    password: ""
  });

  

  const [message, setMessage] = useState("");

  function handleChange(e) {
    setFormValues({ ...formValues, [e.target.name]: e.target.value });
  }

  function handleRegisterCollege(event) {
    event.preventDefault();
    fetch('https://edupredict-l9eg.onrender.com/api/college/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formValues)
    })
    .then(res => res.json())
    .then(data => {
      if (data.message) {
        setMessage("Registration Successful!");
      } else if (data.error) {
        setMessage("Error: " + data.error);
      } else {
        setMessage("Unknown response.");
      }
    })
    .catch(() => {
      setMessage("Network or server error.");
    });
  }

  return (
    <form onSubmit={handleRegisterCollege} style={{maxWidth: 500, margin: "auto", display: "flex", flexDirection: "column", gap: 10}}>
      <input name="name" value={formValues.name} onChange={handleChange} placeholder="College Name" required />
      <input name="code" value={formValues.code} onChange={handleChange} placeholder="College Code" required />
      <input name="address" value={formValues.address} onChange={handleChange} placeholder="Address" required />
      <input name="city" value={formValues.city} onChange={handleChange} placeholder="City" required />
      <input name="state" value={formValues.state} onChange={handleChange} placeholder="State" required />
      <input name="pincode" value={formValues.pincode} onChange={handleChange} placeholder="Pincode" required />
      <input name="email" type="email" value={formValues.email} onChange={handleChange} placeholder="Email" required />
      <input name="phone" value={formValues.phone} onChange={handleChange} placeholder="Phone" required />
      <input name="principal_name" value={formValues.principal_name} onChange={handleChange} placeholder="Principal Name" required />
      <select name="college_type" value={formValues.college_type} onChange={handleChange} required>
        <option value="">--Select Type--</option>
        <option value="autonomous">Autonomous</option>
        <option value="non-autonomous">Non-Autonomous</option>
      </select>
      <select name="category" value={formValues.category} onChange={handleChange} required>
        <option value="">--Select Category--</option>
        <option value="institute">Institute</option>
        <option value="university">University</option>
      </select>
      <select name="aided" value={formValues.aided} onChange={handleChange} required>
        <option value="">--Select--</option>
        <option value="aided">Aided</option>
        <option value="non-aided">Non-Aided</option>
      </select>
      <input name="password" type="password" value={formValues.password} onChange={handleChange} placeholder="Password" required />
      <button type="submit">Register College</button>
      {message && <div style={{marginTop:20, fontWeight:"bold"}}>{message}</div>}
    </form>
  );
}

export default RegisterCollegeForm;