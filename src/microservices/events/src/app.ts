import express, { Request, Response, Application } from 'express';
import { Kafka, Producer, Partitioners } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';

const app: Application = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const kafkaBrokers = process.env.KAFKA_BROKERS || 'localhost:9092';
const kafka = new Kafka({
  clientId: 'events-service',
  brokers: [kafkaBrokers]
});

let producer: Producer;

async function initKafka() {
  try {
    producer = kafka.producer({ 
      createPartitioner: Partitioners.DefaultPartitioner 
    });
    await producer.connect();
    console.log('Kafka producer connected successfully');
  } catch (error) {
    console.error('Failed to connect to Kafka:', error);
    process.exit(1);
  }
}

async function subscribeToTopics() {
  try {
    let consumer = kafka.consumer({ groupId: 'events-service-group' });
    await consumer.connect();
    
    await consumer.subscribe({ topic: 'movie-events', fromBeginning: false });
    await consumer.subscribe({ topic: 'user-events', fromBeginning: false });
    await consumer.subscribe({ topic: 'payment-events', fromBeginning: false });
    
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        console.log("Got message from KAFKA:")
        console.log({
          topic,
          partition,
          offset: message.offset,
          key: message.key?.toString(),
          value: message.value?.toString(),
        });
      },
    });
    
    console.log('Successfully subscribed to topics');
  } catch (error) {
    console.error('Error subscribing to topics:', error);
  }
}


app.get('/', (req: Request, res: Response) => {
  res.json({ 
    message: 'Events Service - CinemaAbyss Platform',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/events/health', (req: Request, res: Response) => {
  res.json({ 
    status: true,
    service: 'events-service',
    timestamp: new Date().toISOString()
  });
});

// Movie event endpoint
app.post('/api/events/movie', async (req: Request, res: Response) => {
  try {
    const event = {
      id: uuidv4(),
      type: 'movie',
      timestamp: new Date().toISOString(),
      payload: req.body
    };

    // Валидация обязательных полей
    if (!event.payload.movie_id || !event.payload.title || !event.payload.action) {
      return res.status(400).json({ 
        error: 'Missing required fields: movie_id, title, action' 
      });
    }

    // Отправка события в Kafka
    const result = await producer.send({
      topic: 'movie-events',
      messages: [
        { 
          key: event.payload.movie_id.toString(),
          value: JSON.stringify(event)
        }
      ]
    });

    res.status(201).json({
      status: 'success',
      partition: result[0].partition,
      offset: result[0].offset,
      event: event
    });
  } catch (error) {
    console.error('Error publishing movie event:', error);
    res.status(500).json({ 
      error: 'Failed to publish movie event'
    });
  }
});

// User event endpoint
app.post('/api/events/user', async (req: Request, res: Response) => {
  try {
    const event = {
      id: uuidv4(),
      type: 'user',
      timestamp: new Date().toISOString(),
      payload: req.body
    };

    // Валидация обязательных полей
    if (!event.payload.user_id || !event.payload.action || !event.payload.timestamp) {
      return res.status(400).json({ 
        error: 'Missing required fields: user_id, action, timestamp' 
      });
    }

    // Отправка события в Kafka
    const result = await producer.send({
      topic: 'user-events',
      messages: [
        { 
          key: event.payload.user_id.toString(),
          value: JSON.stringify(event)
        }
      ]
    });

    res.status(201).json({
      status: 'success',
      partition: result[0].partition,
      offset: result[0].offset,
      event: event
    });
  } catch (error) {
    console.error('Error publishing user event:', error);
    res.status(500).json({ 
      error: 'Failed to publish user event'
    });
  }
});

// Payment event endpoint
app.post('/api/events/payment', async (req: Request, res: Response) => {
  try {
    const event = {
      id: uuidv4(),
      type: 'payment',
      timestamp: new Date().toISOString(),
      payload: req.body
    };

    // Валидация обязательных полей
    if (!event.payload.payment_id || !event.payload.user_id || 
        !event.payload.amount || !event.payload.status || !event.payload.timestamp) {
      return res.status(400).json({ 
        error: 'Missing required fields: payment_id, user_id, amount, status, timestamp' 
      });
    }

    // Отправка события в Kafka
    const result = await producer.send({
      topic: 'payment-events',
      messages: [
        { 
          key: event.payload.payment_id.toString(),
          value: JSON.stringify(event)
        }
      ]
    });

    res.status(201).json({
      status: 'success',
      partition: result[0].partition,
      offset: result[0].offset,
      event: event
    });
  } catch (error) {
    console.error('Error publishing payment event:', error);
    res.status(500).json({ 
      error: 'Failed to publish payment event'
    });
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  try {
    await producer.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  try {
    await producer.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

// Запуск сервера
async function startServer() {
  await initKafka();
  await subscribeToTopics();
  
  app.listen(PORT, () => {
    console.log(`🚀 Events service запущен на порту ${PORT}`);
    console.log(`Kafka brokers: ${kafkaBrokers}`);
  });
}

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});