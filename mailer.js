const nodemailer  = require('nodemailer')

const senderMail = process.env.SENDER_MAIL
const senderPassword = process.env.SENDER_PSWRD


const transporter =nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: senderMail,
        password: senderPassword
    }
})

const email = async (options = {to: "", subject: "", content: "", html: ""}) => {
    let { to, subject, content } = options;
    let mailOpts = {
        from: senderMail,
        to: to,
        subject: subject,
        text: content,
        html: html
    };
    await transporter.sendMail(mailOpts, (err, info) => {
        if (err) console.error(err)
        else console.log(`Email sent (${info.response})`)
    });
}

module.exports = email;