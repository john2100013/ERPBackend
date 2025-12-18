# Email Configuration Guide

This guide explains how to configure email sending for OTP codes in the AwesomeInvoice application.

## Quick Setup

Add the following environment variables to your `.env` file in the backend directory.

## Option 1: Gmail (Easiest for Development)

```env
# Email Configuration
EMAIL_PROVIDER=gmail
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-app-password
EMAIL_FROM=your-email@gmail.com
EMAIL_FROM_NAME=AwesomeInvoice
```

**Important:** You need to use an [App Password](https://support.google.com/accounts/answer/185833), not your regular Gmail password.

### Steps to get Gmail App Password:
1. Go to your Google Account settings
2. Enable 2-Step Verification
3. Go to App Passwords
4. Generate a new app password for "Mail"
5. Use that 16-character password in `GMAIL_APP_PASSWORD`

## Option 2: SMTP (Works with Most Email Providers)

### For Gmail SMTP:
```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_REJECT_UNAUTHORIZED=false
EMAIL_FROM=your-email@gmail.com
EMAIL_FROM_NAME=AwesomeInvoice
```

### For Outlook/Hotmail:
```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@outlook.com
SMTP_PASSWORD=your-password
EMAIL_FROM=your-email@outlook.com
EMAIL_FROM_NAME=AwesomeInvoice
```

### For Custom SMTP Server:
```env
EMAIL_PROVIDER=smtp
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@yourdomain.com
SMTP_PASSWORD=your-password
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=AwesomeInvoice
```

## Option 3: SendGrid (Recommended for Production)

1. Sign up at [SendGrid](https://sendgrid.com/)
2. Create an API Key
3. Add to `.env`:

```env
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.your-api-key-here
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=AwesomeInvoice
```

**Note:** You need to verify your sender email/domain in SendGrid.

## Option 4: Resend (Modern Email Service)

1. Sign up at [Resend](https://resend.com/)
2. Create an API Key
3. Add to `.env`:

```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_your-api-key-here
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=AwesomeInvoice
```

## Development Mode

If no email configuration is provided, the application will:
- Log the OTP to the console
- Not send actual emails
- Still function for testing

## Environment Variables Summary

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `EMAIL_PROVIDER` | No | Email provider: `gmail`, `smtp`, `sendgrid`, `resend` | `gmail` |
| `EMAIL_FROM` | No | Sender email address | `noreply@awesomeinvoice.com` |
| `EMAIL_FROM_NAME` | No | Sender display name | `AwesomeInvoice` |
| `SMTP_HOST` | Yes* | SMTP server hostname | `smtp.gmail.com` |
| `SMTP_PORT` | No | SMTP port (default: 587) | `587` |
| `SMTP_SECURE` | No | Use SSL/TLS (default: false) | `false` |
| `SMTP_USER` | Yes* | SMTP username/email | `user@example.com` |
| `SMTP_PASSWORD` | Yes* | SMTP password | `password123` |
| `SMTP_REJECT_UNAUTHORIZED` | No | Reject unauthorized certs | `false` |
| `GMAIL_USER` | Yes** | Gmail email address | `user@gmail.com` |
| `GMAIL_APP_PASSWORD` | Yes** | Gmail app password | `abcd efgh ijkl mnop` |
| `SENDGRID_API_KEY` | Yes*** | SendGrid API key | `SG.xxxxx` |
| `RESEND_API_KEY` | Yes**** | Resend API key | `re_xxxxx` |

*Required if using `EMAIL_PROVIDER=smtp`  
**Required if using `EMAIL_PROVIDER=gmail`  
***Required if using `EMAIL_PROVIDER=sendgrid`  
****Required if using `EMAIL_PROVIDER=resend`

## Testing Email Configuration

After configuring, test by requesting a password reset. Check:
1. Your email inbox (and spam folder)
2. Console logs for any errors
3. In development mode, OTP will be logged to console

## Production Recommendations

1. **Use a dedicated email service** (SendGrid, Resend, AWS SES)
2. **Verify your domain** for better deliverability
3. **Set up SPF/DKIM records** for your domain
4. **Monitor email delivery** and bounce rates
5. **Never commit `.env` file** to version control

## Troubleshooting

### Gmail "Less secure app" error
- Use App Password instead of regular password
- Enable 2-Step Verification first

### Connection timeout
- Check firewall settings
- Verify SMTP port is open
- Try port 465 with `SMTP_SECURE=true`

### Authentication failed
- Verify username/password are correct
- For Gmail, ensure you're using App Password
- Check if account has 2FA enabled

### Emails going to spam
- Verify your domain/email
- Set up SPF and DKIM records
- Use a professional email service

