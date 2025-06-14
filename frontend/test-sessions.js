// Test script to debug session creation issue
// Run this in the browser console after logging in

async function testSessionAPI() {
  const API_BASE = 'http://localhost:12021/api';
  const token = localStorage.getItem('token');
  
  console.log('=== Session API Test ===');
  console.log('Token present:', !!token);
  
  try {
    // 1. List current sessions
    console.log('\n1. Fetching current sessions...');
    const listResponse = await fetch(`${API_BASE}/sessions`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    const listResult = await listResponse.json();
    console.log('Current sessions:', listResult);
    console.log('Session count:', listResult.data?.length || 0);
    
    // 2. Create a new session
    const sessionName = `Test Session ${new Date().toISOString()}`;
    console.log(`\n2. Creating new session: "${sessionName}"...`);
    const createResponse = await fetch(`${API_BASE}/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: sessionName })
    });
    const createResult = await createResponse.json();
    console.log('Create response:', createResult);
    
    if (createResult.success && createResult.data) {
      console.log('✓ Session created successfully');
      console.log('  ID:', createResult.data.id);
      console.log('  Name:', createResult.data.name);
    } else {
      console.error('✗ Failed to create session');
    }
    
    // 3. List sessions again
    console.log('\n3. Fetching sessions after create...');
    const listResponse2 = await fetch(`${API_BASE}/sessions`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    const listResult2 = await listResponse2.json();
    console.log('Sessions after create:', listResult2);
    console.log('New session count:', listResult2.data?.length || 0);
    
    // 4. Check if new session is in the list
    if (createResult.success && createResult.data && listResult2.data) {
      const foundSession = listResult2.data.find(s => s.id === createResult.data.id);
      if (foundSession) {
        console.log('✓ New session found in list:', foundSession);
      } else {
        console.error('✗ New session NOT found in list!');
        console.log('Looking for ID:', createResult.data.id);
        console.log('Available IDs:', listResult2.data.map(s => s.id));
      }
    }
    
    // 5. Check React state
    console.log('\n4. Checking React state...');
    console.log('Check the UI - you should see', listResult2.data?.length || 0, 'sessions');
    console.log('If the UI shows fewer sessions, there\'s a React state update issue');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testSessionAPI();