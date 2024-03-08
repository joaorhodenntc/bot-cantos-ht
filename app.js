const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

const token = '6416421723:AAGcrBVbPY9E8-bIdK_4-AeM7t1KCtpn4AA'
const chat_bot = '-1002029519353'
const chat_error = '-1002016006632'
const bot = new TelegramBot(token, { polling: false });
const app = express();

async function obterPartidas() {
    const url = "https://apiv3.apifootball.com/?action=get_events&match_live=1&APIkey=b4baff26a1727aeec248d821ea38e2f6d06a02246d7ebcdf00bdc20889e7633c";
    const response = await axios.get(url);
    return response.data;
}

async function obterOdds(idPartida){ 
    const url = `https://apiv3.apifootball.com/?action=get_odds&APIkey=b4baff26a1727aeec248d821ea38e2f6d06a02246d7ebcdf00bdc20889e7633c&match_id=${idPartida}`
    const response = await axios.get(url);
    return response.data;
}

async function enviarMensagemTelegram(chat_id,mensagem) {
    try {
        await bot.sendMessage(chat_id, mensagem, { parse_mode: 'Markdown' });
    } catch (error) {
        console.error('Erro ao enviar mensagem para o Telegram:', error);
    }
}

function casaFavoritoPressao(apHome, scoreHome, scoreAway, idPartida, partidasNotificadas, minutes, chutesHome){
    if((apHome/minutes>= 1.20) && (scoreHome==scoreAway || (scoreAway - scoreHome)==1) && chutesHome>=8 &&!partidasNotificadas.has(idPartida)){
        return true
    }
}

function foraFavoritoPressao(apAway, scoreHome, scoreAway, idPartida, partidasNotificadas, minutes, chutesAway){
    if((apAway/minutes>= 1.20) && (scoreHome==scoreAway || (scoreHome - scoreAway)==1)  && chutesAway>=8 && !partidasNotificadas.has(idPartida)){
        return true
    }
}

const partidasEmAnalise = new Set();
const partidasNotificadas = new Set();
var qtdPartidas = 0;

async function analisarPartidas(){
    const dados = await obterPartidas();
    qtdPartidas = dados.length;
    for(let i=0; i<qtdPartidas; i++){
        const nomeHome = dados[i].match_hometeam_name;
        const nomeAway = dados[i].match_awayteam_name;
        const minutes = dados[i].match_status;
        if(minutes!='Finished' && ((minutes>=37 && minutes<=41))){
            const dangerousAttacks = dados[i].statistics.find(stat => stat.type === 'Dangerous Attacks');
            partidasEmAnalise.add(`${nomeHome} x ${nomeAway}`);
            if(dangerousAttacks){
                const apHome = dangerousAttacks.home; 
                const apAway = dangerousAttacks.away;
                const idPartida = dados[i].match_id;
                const scoreHome = dados[i].match_hometeam_score;
                const scoreAway = dados[i].match_awayteam_score;
                const onTarget = dados[i].statistics.find(stat => stat.type === 'On Target');
                const onTargetHome = onTarget.home;
                const onTargetAway = onTarget.away;
                const offTarget = dados[i].statistics.find(stat => stat.type === 'Off Target');
                const offTargetHome = offTarget.home;
                const offTargetAway = offTarget.away;
                const chutesHome = onTargetHome + offTargetHome;
                const chutesAway = onTargetAway + offTargetAway;
                try{
                    const odds = await obterOdds(idPartida);
                    const oddHome = odds[4].odd_1;
                    const oddAway = odds[4].odd_2;
                    if(casaFavoritoPressao(apHome, scoreHome, scoreAway, idPartida, partidasNotificadas, minutes, chutesHome) || foraFavoritoPressao(apAway, scoreHome, scoreAway, idPartida, partidasNotificadas, minutes, chutesAway)){
                            const mensagem = `*${nomeHome}* vs *${nomeAway}*\n\n⚽ Placar: ${scoreHome} x ${scoreAway}\n⚔️ Ataques Perigosos: ${apHome >= 45 ? '*' + apHome + '* 🔥' : apHome} x ${apAway >= 45 ? '*' + apAway + '* 🔥' : apAway}\n📈 Odds Pré: ${oddHome <= 1.45 ? oddHome + ' 👑' : oddHome} x ${oddAway <= 1.45 ? oddAway + ' 👑' : oddAway}\n🕛 Tempo: ${minutes}`;
                            await enviarMensagemTelegram(chat_bot,mensagem);
                            console.log(mensagem);
                            partidasNotificadas.add(idPartida);
                    }
                    } catch (error){
                    }
                
            } 
        } else {
            partidasEmAnalise.delete(`${nomeHome} x ${nomeAway}`);
        }
    }
}


analisarPartidas()

setInterval(iniciar, 60000);

async function iniciar() {
    try {
        await analisarPartidas();
        console.log(qtdPartidas + " Jogos ao vivo,"+" Analisando " + partidasEmAnalise.size + " Partidas," + " Partidas Notificadas: ["+ [...partidasNotificadas].join(", ")+"]");
    } catch (error) {
        console.log(error);
        await enviarMensagemTelegram(chat_error,error);
    }
}

const port = process.env.PORT || 3002; 

app.get('/cantos-ht', (req, res) => {
    const horaAtual = new Date().toLocaleString();
    res.send("<b>BOT CANTO HT</b><br>"+ " 🚨 "+ qtdPartidas + " Jogos ao vivo<br>"+" 🤖 Analisando " + partidasEmAnalise.size + " Partidas<br>" + " 💾 Partidas Notificadas: ["+ [...partidasNotificadas].join(", ")+"]<br>" + " ⏰ Hora atual: " + horaAtual);
});

app.get('/cantos-ht/aovivo', (req, res) => {
    const nomesDosTimes = [...partidasEmAnalise]; // Convertendo o Set para um array
    res.send(nomesDosTimes);  
});

// Inicie o servidor para ouvir na porta especificada
app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});
