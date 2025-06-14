// Test API endpoint
async function testAPI() {
  try {
    // First try without auth
    console.log('Testing without auth...');
    const res1 = await fetch('http://localhost:12021/api/sessions');
    console.log('Without auth - Status:', res1.status);
    if (res1.ok) {
      const data = await res1.json();
      console.log('Without auth - Data:', data);
    }

    // Now try with a test token
    console.log('\nTesting with fake token...');
    const res2 = await fetch('http://localhost:12021/api/sessions', {
      headers: {
        'Authorization': 'Bearer fake-token-123'
      }
    });
    console.log('With fake token - Status:', res2.status);
    if (!res2.ok) {
      const text = await res2.text();
      console.log('With fake token - Response:', text);
    }

    // Test login endpoint
    console.log('\nTesting login...');
    const loginRes = await fetch('http://localhost:12021/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });
    console.log('Login - Status:', loginRes.status);
    const loginData = await loginRes.json();
    console.log('Login - Data:', loginData);

    if (loginData.success && loginData.data?.token) {
      // Test with real token
      console.log('\nTesting with real token...');
      const res3 = await fetch('http://localhost:12021/api/sessions', {
        headers: {
          'Authorization': `Bearer ${loginData.data.token}`
        }
      });
      console.log('With real token - Status:', res3.status);
      const data3 = await res3.json();
      console.log('With real token - Data:', data3);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

testAPI();