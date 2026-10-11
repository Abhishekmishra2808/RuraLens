import mongoose from 'mongoose';

export async function connectDatabase() {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ruralens', {
      serverSelectionTimeoutMS: 3000, // Fast timeout for offline mode
      connectTimeoutMS: 3000,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB disconnected');
    });

    return conn;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.log('\n⚠️  WARNING: Running in OFFLINE MODE with mock data');
    console.log('💡 To connect to MongoDB:');
    console.log('   - Install MongoDB: https://www.mongodb.com/try/download/community');
    console.log('   - Or use MongoDB Atlas (cloud): https://www.mongodb.com/cloud/atlas');
    console.log('   - Update MONGODB_URI in .env file\n');
    
    // Don't exit - allow server to run with mock data
    return null;
  }
}

export async function seedDatabase() {
  try {
    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      console.log('ℹ️  Skipping database seeding (MongoDB not connected)');
      return;
    }

    const User = (await import('../models/User.js')).default;
    const Scheme = (await import('../models/Scheme.js')).default;

  // Check if admin exists
  const adminExists = await User.findOne({ email: process.env.ADMIN_EMAIL });
  
  if (!adminExists) {
    // Create admin
    await User.create({
      name: process.env.ADMIN_NAME || 'Administrator',
      email: process.env.ADMIN_EMAIL || 'admin@ruralens.com',
      password: process.env.ADMIN_PASSWORD || 'admin123',
      role: 'admin',
      area: 'Ramgarh'
    });
    console.log('✅ Default admin user created');
    console.log(`   Email: ${process.env.ADMIN_EMAIL}`);
    console.log(`   Password: ${process.env.ADMIN_PASSWORD}`);

    // Create demo field worker
    await User.create({
      name: 'Field Worker Demo',
      email: 'field@ruralens.com',
      password: 'field123',
      role: 'field_worker',
      area: 'Ramgarh'
    });
    console.log('✅ Demo field worker created (field@ruralens.com / field123)');

    // Create demo citizen
    await User.create({
      name: 'Citizen Demo',
      email: 'citizen@ruralens.com',
      password: 'user123',
      role: 'user',
      area: 'Ramgarh'
    });
    console.log('✅ Demo citizen created (citizen@ruralens.com / user123)');
  }

  // Check if schemes exist
  const schemesCount = await Scheme.countDocuments();
  if (schemesCount === 0) {
    // Import initial schemes data
    const { generateInfraData } = await import('../utils/dataGenerator.js');
    const initialData = generateInfraData();
    
    if (initialData.schemes && initialData.schemes.length > 0) {
      // Clean up the schemes data to ensure proper format
      const cleanedSchemes = initialData.schemes.map(scheme => ({
        ...scheme,
        discrepancies: scheme.discrepancies || [],
        phases: scheme.phases || [],
        vendorReports: scheme.vendorReports || []
      }));
      
      await Scheme.insertMany(cleanedSchemes);
      console.log(`✅ Seeded ${cleanedSchemes.length} government schemes`);
    }
  } else {
    console.log(`ℹ️  Database already has ${schemesCount} schemes`);
  }
  } catch (error) {
    console.error('❌ Database seeding failed:', error.message);
  }
}
