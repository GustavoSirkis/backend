import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import nodemailer from "nodemailer";
import { prisma } from "../lib/prisma";
import { dayjs } from "../lib/dayjs";
import { getMailClient } from "../lib/mail";
import { ClientError } from "../errors/client-error";
import { env } from "../env";

export async function createInvite(app: FastifyInstance){
  app.withTypeProvider<ZodTypeProvider>().post(
    '/trips/:tripId/invites',
    {
      schema: {
        params: z.object({
          tripId: z.string().uuid()
        }),
        body: z.object({
          email: z.string().email(),
        })
      }
    }, 
    async (request) => {
      const { tripId } = request.params
      const { email } = request.body

    const trip = await prisma.trip.findUnique({
      where: {id: tripId}
    })

    if(!trip){
      throw new ClientError('Trip not found')
    }

    const participant = await prisma.participant.create({
      data: {
        email,
        trip_id: tripId,
      }
    })

    const formattedStartsAt = dayjs(trip.starts_at).format('LL')
    const formattedEndsAT = dayjs(trip.ends_at).format('LL')

    const mail = await getMailClient();

    const confirmationLink = `${env.API_BASE_URL}/participants/${participant.id}/confirm `


    const message = await mail.sendMail({
      from: {
        name: 'Equipe  planner',
        address: 'oi@plann.er',
      },
      to: participant.email,
      subject: `Confirme sua presença na viagem para ${trip.destination} em ${formattedStartsAt}`,
      html: `
        <div style="font-family: sans-serif; font-size: 16px; line-height: 1.6;">
          <p>Olá ${participant.name}, você foi convidado(a) para participar de uma viagem para <strong>${trip.destination}</strong>, nas datas de  <strong>${formattedStartsAt} </strong> a <strong>${formattedEndsAT}</strong>.</p>
          <p></p>
          <p>Para confirmar sua presença na viagem, clique no link abaixo:</p>
          <p></p>
          <p>
            <a href="${confirmationLink}">Confirmar Presença</a>
          </p>
          <p></p>
          <p>Caso esteja usando o dispositivo móvel, você também pode confirmar presença pelos aplicativos:</p>
          <p></p>
          <ul>
            <li>
              <a href="${"#"}">Aplicativo para Iphone</a>
            </li>
            <li>
              <a href="${"#"}">Aplicativo para Android</a>
            </li>                  
          </ul>
          <p></p>
          <p>Caso você não saiba do que se trata esse e-mail ou não poderá estar presente, apenas ignore esse e-mail.</p>
          </div>
        `.trim()
      })

    console.log(nodemailer.getTestMessageUrl(message))


    return { participantId: participant.id }
  })
}