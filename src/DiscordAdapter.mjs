import Adapter from 'hubot/src/adapter.js'
import HubotMessageFromDiscord from './HubotMessageFromDiscord.mjs'
import EventEmitter from 'node:events'
import { Events, Embed, EmbedBuilder, AttachmentBuilder, MessagePayload } from 'discord.js'

const CONTENT_LENGTH_LIMIT = 2_000

class DiscordAdapter extends Adapter {
    constructor(robot, client = new EventEmitter()) {
        super(robot)
        this.client = client
        this.client.on(Events.Error, this.errorHasOccurred.bind(this))
        this.client.on(Events.MessageUpdate, this.messageWasUpdated.bind(this))
        this.client.on(Events.MessageCreate, this.messageWasReceived.bind(this))
        this.client.once(Events.ClientReady, () => {
            this.emit('connected')
        })
    }
    messageWasUpdated(oldMessage, newMessage) {
        this.robot.receive(new HubotMessageFromDiscord(newMessage))
    }
    messageWasReceived(message) {
        this.robot.receive(new HubotMessageFromDiscord(message))
    }
    send(envelope, ...strings) {
        this.emit('send', envelope, ...strings)
    }
    async reply(envelope, ...strings) {
        const tasks = []
        for (let message of strings) {
            if(message instanceof Embed || message instanceof EmbedBuilder) {
                tasks.push(envelope.user.message.reply({embeds: [message]}))
                continue
            }

            if(message instanceof AttachmentBuilder) {
                resp.push(envelope.user.message.reply({ files: [message] }))
                continue
            }

            if(typeof message == 'object') {   
                if(message.files){
                    let files = message.files.map(f => {
                        let a = new AttachmentBuilder(f.file)
                        a.setName(f.name)
                        a.setDescription(f.description)
                        return a
                    })
                    tasks.push(envelope.user.message.reply({files: files}))
                } else {
                    let payload = new MessagePayload(envelope.user.message, message)
                    payload = Object.assign(payload, message)
                    tasks.push(envelope.user.message.reply(payload))
                }
                continue
            }

            for (let part of this.breakUpMessage(message)) {
                tasks.push(envelope.user.message.reply(part))
            }
        }
        const responses = await Promise.all(tasks)
        this.emit('reply', envelope, responses)
        return responses
    }
    errorHasOccurred(error) {
        console.error(error)
    }
    update(key, old, value) {
        console.log('hi', key, old, value)
    }
    run() {
        return this.client.login(this.robot.config.DISCORD_TOKEN)
            .then(() => this.robot.logger.info('Successfully logged in'))
            .catch(e => this.robot.logger.error(e, 'Failed to log in'))
    }
    async close () {
        await this.client.destroy()
    }
    breakUpMessage(text) {
        const message = []
        while (text.length > 0) {
            message.push(text.slice(0, CONTENT_LENGTH_LIMIT))
            text = text.slice(CONTENT_LENGTH_LIMIT - 1)
        }
        return message
    }
}
export {
    DiscordAdapter
}  