import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendBackupEmail(to: string, filename: string, jsonContent: string) {
  await resend.emails.send({
    from: 'Family Finance <onboarding@resend.dev>',
    to,
    subject: `[Family Finance] Backup dữ liệu – ${filename.replace('.json', '')}`,
    text: 'File backup dữ liệu tài chính gia đình đính kèm theo email này.',
    attachments: [
      {
        filename,
        content: Buffer.from(jsonContent).toString('base64'),
      },
    ],
  })
}
