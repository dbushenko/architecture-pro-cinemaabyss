import express, { Application, Request, Response, NextFunction } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app: Application = express();
const PORT: string = process.env.PORT || '3000';

// Middleware для парсинга JSON
app.use(express.json());

const monolithTarget: string = process.env.MONOLITH_URL || 'http://localhost:8080';
const moviesServiceTarget: string = process.env.MOVIES_SERVICE_URL || 'http://localhost:8081';
const eventsServiceTarget: string = process.env.EVENTS_SERVICE_URL || 'http://localhost:8082';

const moviesServicePercentage: number = parseInt(process.env.MOVIES_SERVICE_PERCENTAGE || '0', 10);

const shouldRouteToMoviesService = (): boolean => {
  const random = Math.floor(Math.random() * 100);
  return random < moviesServicePercentage;
};

// Маршрутизация для событий
app.use('/api/events', (req: Request, res: Response, next: NextFunction) => {
  console.log(`Routing /api/events request to ${eventsServiceTarget}`);
  
  const proxy = createProxyMiddleware({
    target: eventsServiceTarget,
    changeOrigin: true,
    pathRewrite: {
      '^/api': '/api',
    },
    logLevel: 'debug',
  });
  
  return proxy(req, res, next);
});

// Маршрутизация для фильмов
app.use('/api/movies', (req: Request, res: Response, next: NextFunction) => {
  const target = shouldRouteToMoviesService() ? moviesServiceTarget : monolithTarget;
  
  console.log(`Routing /api/movies request to ${target}`);
  
  const proxy = createProxyMiddleware({
    target: target,
    changeOrigin: true,
    pathRewrite: {
      '^/api': '/api',
    },
    logLevel: 'debug',
  });
  
  return proxy(req, res, next);
});

// Маршрутизация для всех остальных запросов к монолиту
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  console.log(`Routing /api request to ${monolithTarget}`);
  
  const proxy = createProxyMiddleware({
    target: monolithTarget,
    changeOrigin: true,
    pathRewrite: {
      '^/api': '/api',
    },
    logLevel: 'debug',
  });
  
  return proxy(req, res, next);
});

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'proxy' });
});

app.listen(PORT, () => {
  console.log(`Proxy server is running on port ${PORT}`);
  console.log(`Monolith target: ${monolithTarget}`);
  console.log(`Movies service target: ${moviesServiceTarget}`);
  console.log(`Events service target: ${eventsServiceTarget}`);
  console.log(`Movies service percentage: ${moviesServicePercentage}%`);
});