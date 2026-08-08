import Imap from 'imap-simple';
import { simpleParser } from 'mailparser';
import { query, queryOne, logActivity } from '../database/db.js';
import * as aiService from './aiService.js';
import { v4 as uuidv4 } from 'uuid';
import { getIO } from '../socket.js';

let connections = {};

export async function startImapListener(user_id, credentials) {
  if (connections[user_id]) {
    connections[user_id].end();
  }

  const config = {
    imap: {
      user: credentials.email,
      password: credentials.password,
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      authTimeout: 3000,
      tlsOptions: { rejectUnauthorized: false }
    }
  };

  try {
    const connection = await Imap.connect(config);
    connections[user_id] = connection;

    await connection.openBox('INBOX');

    connection.on('mail', async (numNewMail) => {
      console.log(`[IMAP] ${numNewMail} new mail(s) received for user ${user_id}`);
      const searchCriteria = ['UNSEEN'];
      const fetchOptions = { bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)', 'TEXT'], markSeen: true };
      
      try {
        const messages = await connection.search(searchCriteria, fetchOptions);
        
        for (const item of messages) {
          const all = item.parts.find(part => part.which === 'TEXT');
          const header = item.parts.find(part => part.which === 'HEADER.FIELDS (FROM TO SUBJECT DATE)');
          
          if (all && all.body) {
            const parsed = await simpleParser(all.body);
            const subject = header.body.subject ? header.body.subject[0] : '';
            const from = header.body.from ? header.body.from[0] : '';
            const textContent = parsed.text || parsed.html || '';

            console.log(`[IMAP] Analyzing email from ${from}: ${subject}`);
            await processIncomingEmail(user_id, subject, from, textContent);
          }
        }
      } catch (err) {
        console.error(`[IMAP Error fetching mail]`, err);
      }
    });

    console.log(`[IMAP] Listener started successfully for user: ${user_id}`);
  } catch (error) {
    console.error(`[IMAP Connection Error] user: ${user_id}`, error.message);
  }
}

async function processIncomingEmail(user_id, subject, from, content) {
  try {
    const prompt = `
      You are an AI assistant helping a job seeker. You are analyzing an incoming email.
      Your task is to determine if this email is an invitation to interview for a job.
      
      Email Subject: ${subject}
      Email From: ${from}
      Email Body:
      ${content.substring(0, 3000)}
      
      Respond STRICTLY in JSON format:
      {
        "is_interview": boolean,
        "company_name": "Name of company (if found)",
        "scheduled_time": "Extracted date/time or empty",
        "meeting_link": "Zoom/Teams link or empty",
        "reasoning": "Short explanation"
      }
    `;

    const resultStr = await aiService.analyzeChatWithAI([{ role: 'user', content: prompt }]);
    let result;
    try {
      const match = resultStr.match(/\{[\s\S]*\}/);
      result = JSON.parse(match ? match[0] : resultStr);
    } catch (e) {
      console.error("[IMAP] Failed to parse Gemini JSON", e);
      return;
    }

    if (result.is_interview && result.company_name) {
      console.log(`[IMAP] Detected interview for ${result.company_name}!`);
      
      const appRecord = await queryOne(`
        SELECT a.id, j.title, j.company 
        FROM applications a 
        JOIN jobs j ON a.job_id = j.id 
        WHERE a.user_id = $1 AND j.company ILIKE $2
        ORDER BY a.created_at DESC LIMIT 1
      `, [user_id, `%${result.company_name}%`]);

      const id = `int_${uuidv4().replace(/-/g, '').substring(0, 16)}`;

      await query(`
        INSERT INTO interviews (id, user_id, application_id, company, scheduled_time, meeting_link, email_subject, email_body)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        id, 
        user_id, 
        appRecord ? appRecord.id : null, 
        result.company_name, 
        result.scheduled_time || '', 
        result.meeting_link || '',
        subject,
        content.substring(0, 1000)
      ]);

      if (appRecord) {
        await query('UPDATE applications SET status = $1 WHERE id = $2', ['interviewing', appRecord.id]);
      }

      logActivity({
        action: 'interview_received',
        message: `Interview invitation detected for ${result.company_name}!`,
        entityType: 'interview', entityId: id, status: 'success',
        metadata: { company: result.company_name, time: result.scheduled_time },
        notifTitle: '🎉 Interview Invite!', notifType: 'success', actionUrl: 'applications',
        user_id: user_id
      });

      const io = getIO();
      if (io) {
        io.emit('notification', { title: '🎉 Interview Invite!', message: `You have an interview with ${result.company_name}` });
      }
    }
  } catch (err) {
    console.error(`[IMAP] Error processing email:`, err.message);
  }
}
