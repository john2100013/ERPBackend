import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  private static transporter: nodemailer.Transporter | null = null;

  // Initialize email transporter
  static initializeTransporter(): nodemailer.Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    const emailProvider = process.env.EMAIL_PROVIDER || 'smtp';
    const isDevelopment = process.env.NODE_ENV === 'development';

    // For development, use console logging if no email is configured
    if (isDevelopment && !process.env.SMTP_HOST && !process.env.SENDGRID_API_KEY && !process.env.RESEND_API_KEY) {
      console.log('⚠️  Email service not configured. OTP will be logged to console in development mode.');
      // Create a mock transporter that logs instead of sending
      this.transporter = nodemailer.createTransport({
        streamTransport: true,
        newline: 'unix',
        buffer: true
      } as any);
      return this.transporter;
    }

    switch (emailProvider.toLowerCase()) {
      case 'sendgrid':
        return this.createSendGridTransporter();
      case 'resend':
        return this.createResendTransporter();
      case 'gmail':
        return this.createGmailTransporter();
      case 'smtp':
      default:
        return this.createSMTPTransporter();
    }
  }

  // Create SMTP transporter (works with most email providers)
  private static createSMTPTransporter(): nodemailer.Transporter {
    const config: any = {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    };

    // Add TLS options if needed
    if (process.env.SMTP_REJECT_UNAUTHORIZED === 'false') {
      config.tls = {
        rejectUnauthorized: false,
      };
    }

    this.transporter = nodemailer.createTransport(config);
    return this.transporter;
  }

  // Create Gmail transporter
  private static createGmailTransporter(): nodemailer.Transporter {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD, // Use App Password, not regular password
      },
    });
    return this.transporter;
  }

  // Create SendGrid transporter
  private static createSendGridTransporter(): nodemailer.Transporter {
    this.transporter = nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      secure: false,
      auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY,
      },
    });
    return this.transporter;
  }

  // Create Resend transporter
  private static createResendTransporter(): nodemailer.Transporter {
    this.transporter = nodemailer.createTransport({
      host: 'smtp.resend.com',
      port: 587,
      secure: false,
      auth: {
        user: 'resend',
        pass: process.env.RESEND_API_KEY,
      },
    });
    return this.transporter;
  }

  // Send email
  static async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const transporter = this.initializeTransporter();
      const isDevelopment = process.env.NODE_ENV === 'development';
      const fromEmail = process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@awesomeinvoice.com';
      const fromName = process.env.EMAIL_FROM_NAME || 'AwesomeInvoice';

      const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to: options.to,
        subject: options.subject,
        text: options.text || options.html.replace(/<[^>]*>/g, ''), // Plain text version
        html: options.html,
      };

      // In development without email config, just log
      if (isDevelopment && !process.env.SMTP_HOST && !process.env.SENDGRID_API_KEY && !process.env.RESEND_API_KEY) {
        console.log('\n📧 Email (Development Mode - Not Sent):');
        console.log('   To:', options.to);
        console.log('   Subject:', options.subject);
        console.log('   Content:', options.text || options.html.replace(/<[^>]*>/g, ''));
        console.log('');
        return true;
      }

      const info = await transporter.sendMail(mailOptions);
      console.log('✅ Email sent successfully:', info.messageId);
      return true;
    } catch (error: any) {
      console.error('❌ Error sending email:', error.message);
      // In development, don't fail completely - just log
      if (process.env.NODE_ENV === 'development') {
        console.log('⚠️  Email sending failed, but continuing in development mode');
        return false;
      }
      throw error;
    }
  }

  // Send OTP email
  static async sendOTPEmail(email: string, otp: string, userName?: string): Promise<boolean> {
    const subject = 'Password Reset OTP - AwesomeInvoice';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset OTP</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #1976d2; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0;">AwesomeInvoice</h1>
        </div>
        <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
          <h2 style="color: #1976d2; margin-top: 0;">Password Reset Request</h2>
          ${userName ? `<p>Hello ${userName},</p>` : '<p>Hello,</p>'}
          <p>You have requested to reset your password. Use the following OTP code to proceed:</p>
          <div style="background-color: white; border: 2px dashed #1976d2; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #1976d2; font-size: 36px; letter-spacing: 8px; margin: 0; font-family: 'Courier New', monospace;">${otp}</h1>
          </div>
          <p style="color: #666; font-size: 14px;">
            <strong>This code will expire in 1 hour.</strong>
          </p>
          <p style="color: #666; font-size: 14px;">
            If you didn't request this password reset, please ignore this email or contact support if you have concerns.
          </p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
            This is an automated message, please do not reply to this email.
          </p>
        </div>
      </body>
      </html>
    `;

    const text = `
Password Reset Request

You have requested to reset your password for your AwesomeInvoice account.

Your OTP code is: ${otp}

This code will expire in 1 hour.

If you didn't request this password reset, please ignore this email or contact support.

---
This is an automated message, please do not reply to this email.
    `.trim();

    return this.sendEmail({
      to: email,
      subject,
      html,
      text,
    });
  }
}

