import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import nodemailer from "nodemailer";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { getMailClient } from "../lib/mail";
import { dayjs } from "../lib/dayjs";


export async function createTrip(app: FastifyInstance){
  app.withTypeProvider<ZodTypeProvider>().post('/trips',{
    schema: {
      body: z.object({
        destination: z.string().min(4),
        starts_at: z.coerce.date(),
        ends_at: z.coerce.date(),
        owner_name: z.string(),
        owner_email: z.string().email(),
        emails_to_invite: z.array(z.string().email()),
      })
    }
  }, async (request) => {
    const { destination, starts_at, ends_at, owner_name, owner_email, emails_to_invite } = request.body
    
    if(dayjs(starts_at).isBefore(new Date())){
      throw new Error('Invalid trip start date')
    }

    if(dayjs(ends_at).isBefore(dayjs(starts_at))){
      throw new Error('Invalid trip end date')
    }

    

    const trip = await prisma.trip.create({ 
      data: {
        destination,
        starts_at,
        ends_at,
        participants: {
          createMany:{
            data: [
              {
                name: owner_name,
                email: owner_email,
                is_owner: true,
                is_confirmed: true,
              },
              ...emails_to_invite.map(email => {
                return { email }
              })
            ],
          }
        }

      }
    })

    const formattedStartsAt = dayjs(starts_at).format('LL')
    const formattedEndsAT = dayjs(ends_at).format('LL')

    const confirmationLink = `http://localhost:3333/trips/${trip.id}/confirm`

    const mail = await getMailClient();

    const message = await mail.sendMail({
      from: {
        name: 'Equipe  planner',
        address: 'oi@plann.er',
      },
      to: {
        name: owner_name,
        address: owner_email,
      },
      subject: `Confirme sua viagem para ${destination} em ${formattedStartsAt}`,
      html: `
        <div style="font-family: sans-serif; font-size: 16px; line-height: 1.6;">
          <p>Olá ${owner_name}, a solicitação de viagem com destino a <strong>${destination}</strong>, nas datas de  <strong>${formattedStartsAt} </strong> até <strong>${formattedEndsAT}</strong>.</p>
          <p></p>
          <p>Para confirmar sua viagem, clique no link abaixo:</p>
          <p></p>
          <p>
            <a href="${confirmationLink}">Confirmar Viagem</a>
          </p>
          <p></p>
          <p>Caso você não saiba do que se trata esse e-mail, apenas ignore esse e-mail.</p>
        </div>
        `.trim()
      })

    console.log(nodemailer.getTestMessageUrl(message))
    
    return { tripId: trip.id }
  })
}