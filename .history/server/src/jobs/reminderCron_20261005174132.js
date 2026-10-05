import cron from 'node-cron';
import { Task, Reminder, Note } from '../models/index.js';
import { sendWhatsApp } from '../services/whatsapp.js';

const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 100;
const CRON_EXPRESSION = '* * * * *'; // every minute