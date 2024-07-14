import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { dayjs } from "../lib/dayjs";
import { getMailClient } from "../lib/mail";
import nodemailer from "nodemailer";


export async function confirmTrip(app: FastifyInstance){
  app.withTypeProvider<ZodTypeProvider>().get('/trips/:tripId/confirm', {
    schema: {
      params: z.object({
        tripId: z.string().uuid(),
      })
    }
  }, async (request, reply) => {
      const {tripId} = request.params

      const trip = await prisma.trip.findUnique({
        where: {
          id: tripId,
        },
        include: {
          participants: {
            where: {
              is_owner: false,
            }
          }
        }
      })

      // Verifica se existe a viagem
      if(!trip){
        throw new Error('Trip not found.')
      }

      // Verifica se a viagem já está confirmada
      if(trip.is_confirmed){
        return reply.redirect(`http://localhost:3000/trips/${tripId}`)
      }

      // Atualiza o status da viagem para confirmado
      await prisma.trip.update({
        where: { id: tripId },
        data: {is_confirmed: true}
      })

      // const participants = await prisma.participant.findMany({
      //   where: {
      //     trip_id: tripId,
      //     is_owner: false,
      //   },
      // })

      

      const formattedStartsAt = dayjs(trip.starts_at).format('LL')
      const formattedEndsAT = dayjs(trip.ends_at).format('LL')

      const mail = await getMailClient();

      await Promise.all(
        trip.participants.map(async (participant) => {

          const confirmationLink = `http://localhost:3333/participant/${participant.id}/confirm `


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
        })
      )


      return reply.redirect(`http://localhost:3000/trips/${tripId}`)
  })
}