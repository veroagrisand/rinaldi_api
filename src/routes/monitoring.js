const express = require('express');
const router = express.Router();
const os = require('os');
const { getConnection } = require('../config/database');

// Get server resource usage
router.get('/resources', async (req, res) => {
  try {
    // CPU Usage
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (let type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });
    
    const cpuUsage = 100 - ~~(100 * totalIdle / totalTick);
    
    // Memory Usage
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsagePercent = (usedMemory / totalMemory) * 100;
    
    // Database connections
    const conn = await getConnection();
    const [dbStats] = await conn.query("SHOW STATUS LIKE 'Threads_connected'");
    conn.release();
    
    // User count
    const userConn = await getConnection();
    const [userCount] = await userConn.query('SELECT COUNT(*) as total FROM users');
    userConn.release();
    
    res.json({
      success: true,
      data: {
        cpu: {
          usage_percent: cpuUsage.toFixed(2),
          cores: cpus.length
        },
        memory: {
          total_mb: (totalMemory / 1024 / 1024).toFixed(2),
          used_mb: (usedMemory / 1024 / 1024).toFixed(2),
          free_mb: (freeMemory / 1024 / 1024).toFixed(2),
          usage_percent: memoryUsagePercent.toFixed(2),
          used_kb: Math.floor(usedMemory / 1024)
        },
        database: {
          connections: parseInt(dbStats.Value)
        },
        users: {
          total: userCount[0].total
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get resource usage',
      error: error.message
    });
  }
});

module.exports = router;
