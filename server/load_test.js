import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 100 }, 
    { duration: '20s', target: 500 }, 
    { duration: '10s', target: 0 },   
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'], 
    http_req_duration: ['p(95)<2000'],
  },
};

export default function () {
  const url = 'http://localhost:8000/api/store/my-stores';
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2YTBiZTg0ZTRjZWFjOWUxYmU0N2Q2YTciLCJpc0FkbWluIjp0cnVlLCJpYXQiOjE3NzkzNTY2OTYsImV4cCI6MTc3OTk2MTQ5Nn0.X_ZgP2VWXU7BSKk_g7-DJqpFO1isQ2-ZY0wIFPE4dNY', 
    },
  };

  const res = http.get(url, params);

  check(res, {
    'status is 200': (r) => r.status === 200,
    // 'transaction time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}