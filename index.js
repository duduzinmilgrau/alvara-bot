require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.DISCORD_TOKEN ? String(process.env.DISCORD_TOKEN).trim() : null;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers 
    ]
});

// ==========================================
// CONFIGURAÇÕES GERAIS
// (Substitua 'SEU_ID_AQUI' pelo ID numérico do cargo caso não use o .env)
// ==========================================
const CONFIG = {
    PREFIXO: String(process.env.PREFIXO || '!'),                  
    CARGO_MEMBRO: String(process.env.CARGO_MEMBRO || '').trim(),    
    CANAL_STAFF_APROVACAO: String(process.env.CANAL_STAFF_APROVACAO || '').trim(),
    CANAL_LOG_BAU: String(process.env.CANAL_LOG_BAU || '').trim(),                  
    CANAL_APROVADOS: String(process.env.CANAL_APROVADOS || '').trim(), 
    CANAL_RECUSADOS: String(process.env.CANAL_RECUSADOS || '').trim(),
    CARGO_BLACKLIST: String(process.env.CARGO_BLACKLIST || '').trim(), 
    CANAL_LOG_BLACKLIST: String(process.env.CANAL_LOG_BLACKLIST || '').trim(), 
    CANAL_LOG_ADV: String(process.env.CANAL_LOG_ADV || '').trim(),             
    CANAL_PAINEL_STAFF: String(process.env.CANAL_PAINEL_STAFF || '').trim(),
    CANAL_BOAS_VINDAS: String(process.env.CANAL_BOAS_VINDAS || '').trim(),
    CANAL_LOG_GERAL: String(process.env.CANAL_LOG_GERAL || '').trim(),
    CANAL_VENDAS: String(process.env.CANAL_VENDAS || '').trim(),
    CANAL_ESTOQUE: String(process.env.CANAL_ESTOQUE || '').trim(),
    CANAL_DESMANCHE: String(process.env.CANAL_DESMANCHE || '').trim(),

    CARGOS_HIERARQUIA: {
        'membro': String(process.env.CARGO_MEMBRO || 'SEU_ID_AQUI').trim(),
        'auxiliar': String(process.env.CARGO_AUXILIAR || '').trim(),
        'elite': String(process.env.CARGO_ELITE || '').trim(),
        'gerente de vendas': String(process.env.CARGO_GERENTE_VENDAS || '').trim(),
        'gerente de recrutamento': String(process.env.CARGO_GERENTE_RECRUTAMENTO || '').trim(),
        'gerente geral': String(process.env.CARGO_GERENTE_GERAL || '').trim(),
        '03': String(process.env.CARGO_03 || '').trim(),
        '02': String(process.env.CARGO_02 || '').trim(),
        '01': String(process.env.CARGO_01 || '').trim()
    }
};

// ==========================================
// BANCO DE DADOS LOCAL CONECTADO (JSON)
// ==========================================
const dbPath = path.join(__dirname, 'database.json');
let dbData = { membros: {} };

function carregarDB() {
    try {
        if (fs.existsSync(dbPath)) {
            const dados = fs.readFileSync(dbPath, 'utf-8');
            dbData = JSON.parse(dados);
        } else {
            salvarDB();
        }
    } catch (e) { console.error("Erro ao carregar banco de dados JSON:", e); }
}

function salvarDB() {
    try {
        fs.writeFileSync(dbPath, JSON.stringify(dbData, null, 4), 'utf-8');
    } catch (e) { console.error("Erro ao salvar banco de dados JSON:", e); }
}

function garantirMembroNoDB(userId) {
    if (!dbData.membros[userId]) {
        dbData.membros[userId] = { 
            pontos: 0, vendas: 0, recrutamentos: 0, desmanches: 0,
            historico_diario_rec: { seg: 0, ter: 0, qua: 0, qui: 0, sex: 0, sab: 0, dom: 0 }
        };
    }
}

function adicionarPontosDesmanche(userId) {
    garantirMembroNoDB(userId);
    dbData.membros[userId].desmanches = (dbData.membros[userId].desmanches || 0) + 1;
    dbData.membros[userId].pontos = (dbData.membros[userId].pontos || 0) + 20; 
    salvarDB();
}

function adicionarPontosVenda(userId) {
    garantirMembroNoDB(userId);
    dbData.membros[userId].vendas = (dbData.membros[userId].vendas || 0) + 1;
    dbData.membros[userId].pontos = (dbData.membros[userId].pontos || 0) + 30; 
    salvarDB();
}

function adicionarPontosRecrutamento(userId) {
    garantirMembroNoDB(userId);
    dbData.membros[userId].recrutamentos = (dbData.membros[userId].recrutamentos || 0) + 1;
    dbData.membros[userId].pontos = (dbData.membros[userId].pontos || 0) + 40; 
    salvarDB();
}

carregarDB();
const aguardandoPrint = new Map();

async function enviarLogGeral(guild, embed) {
    if (!CONFIG.CANAL_LOG_GERAL) return;
    try {
        const canalGeral = await guild.channels.fetch(CONFIG.CANAL_LOG_GERAL).catch(() => null);
        if (canalGeral) {
            const embedCopia = EmbedBuilder.from(embed);
            await canalGeral.send({ embeds: [embedCopia] });
        }
    } catch (e) { console.error("Erro ao enviar para o canal de relatórios geral:", e); }
}

function validarConfiguracaoCargo(guild) {
    const cargoBase = guild.roles.cache.get(CONFIG.CARGO_MEMBRO);
    if (!cargoBase) {
        console.error(`ERRO: Cargo Base (${CONFIG.CARGO_MEMBRO}) não encontrado no servidor!`);
        return false;
    }
    return cargoBase;
}

client.once('ready', () => {
    console.log(`🔥 ALVARÁ BOT ONLINE! Moderação de pontos ativa.`);
});

// ==========================================
// BOAS-VINDAS
// ==========================================
client.on('guildMemberAdd', async (member) => {
    try {
        const canalBoasVindas = await member.guild.channels.fetch(CONFIG.CANAL_BOAS_VINDAS).catch(() => null);
        if (canalBoasVindas) {
            const embedBoasVindas = new EmbedBuilder()
                .setTitle('👋 BEM-VINDO(A) À BASE!')
                .setDescription(`Fala ${member}, seja muito bem-vindo(a) à nossa base!\n\n📌 Para liberar o seu acesso completo, não esqueça de ir no canal de registro e fazer o seu formulário, fechou? Tamo junto!`)
                .setColor('#2b2d31')
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                .setImage('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM2NjZGNjYTI5YmE0Yzg5ODBlYjY3ZDVhY2I5YjliZjdkY2FlYmI2MiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/Lp8kMQvAlB6S5EAl9v/giphy.gif')
                .setTimestamp()
                .setFooter({ text: `Usuário nº ${member.guild.memberCount}` });

            await canalBoasVindas.send({ content: `✨ Salve ${member}!`, embeds: [embedBoasVindas] });
        }
    } catch (error) { console.error("Erro boas-vindas:", error); }
});

// ==========================================
// MONITOR DE PRINTS E COMANDOS DE CHAT
// ==========================================
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (aguardandoPrint.has(message.author.id)) {
        const dados = aguardandoPrint.get(message.author.id);
        if (message.attachments.size === 0) return message.reply('❌ Você precisa enviar o print para comprovar a ação! Envie a imagem aqui no chat.').catch(() => {});

        try {
            const imagemUrl = message.attachments.first().url;

            if (dados.sistema === 'desmanche') {
                adicionarPontosDesmanche(message.author.id);

                const embedD = new EmbedBuilder()
                    .setTitle('🔨 NOVO DESMANCHE DETECTADO')
                    .setColor('#e67e22')
                    .setDescription(`👤 **Responsável:** ${message.author}\n🚗 **Veículo:** ${dados.carro}\n🎖️ **Soma de Rank:** +20 Pontos Computados`)
                    .setImage(imagemUrl)
                    .setTimestamp();

                const canalDesmanche = await message.guild.channels.fetch(CONFIG.CANAL_DESMANCHE).catch(() => null);
                if (canalDesmanche) await canalDesmanche.send({ embeds: [embedD] });
                
                await enviarLogGeral(message.guild, embedD);
                await message.reply('✅ Seu desmanche foi registrado e os +20 pontos foram computados com sucesso!');
            
            } else if (dados.sistema === 'bau') {
                const canalLogBau = await message.guild.channels.fetch(CONFIG.CANAL_LOG_BAU).catch(() => null);

                const embedLog = new EmbedBuilder()
                    .setTitle(dados.tipo === 'entrada' ? '📥 ENTRADA DE ITENS NO BAÚ' : '📤 RETIRADA DE ITENS DO BAÚ')
                    .setColor(dados.tipo === 'entrada' ? '#2ecc71' : '#e74c3c')
                    .setDescription(`👤 **Membro:** ${message.author}\n🎒 **O que informou:** ${dados.descricao}`)
                    .setImage(imagemUrl)
                    .setTimestamp()
                    .setFooter({ text: 'ALVARÁ • Sistema de Baú' });

                if (canalLogBau) await canalLogBau.send({ embeds: [embedLog] });
                await enviarLogGeral(message.guild, embedLog);
                await message.reply('✅ Registro de baú enviado com sucesso para a Staff!');
            }
            
            await message.delete().catch(() => {});
            aguardandoPrint.delete(message.author.id);
        } catch (error) { console.error("Erro ao processar print:", error); }
        return;
    }

    if (!message.content.startsWith(CONFIG.PREFIXO)) return;
    const args = message.content.slice(CONFIG.PREFIXO.length).trim().split(' ');
    const command = args.shift().toLowerCase();

    // ==========================================
    // COMANDOS DE STAFF E RANKING
    // ==========================================
    if (command === 'remover-pontos') {
        if (message.channel.id !== CONFIG.CANAL_PAINEL_STAFF) return message.reply('❌ Comando restrito ao canal privado da Staff!').then(m => setTimeout(() => m.delete(), 5000));
        
        const usuarioMencionado = message.mentions.members.first();
        const qtdRemover = parseInt(args[1]);

        if (!usuarioMencionado || isNaN(qtdRemover) || qtdRemover <= 0) {
            return message.reply(`💡 **Modo de Uso:** \`${CONFIG.PREFIXO}remover-pontos @membro <quantidade>\``);
        }

        const targetId = usuarioMencionado.id;
        garantirMembroNoDB(targetId);

        let pontosAtuais = dbData.membros[targetId].pontos || 0;
        dbData.membros[targetId].pontos = Math.max(0, pontosAtuais - qtdRemover);
        salvarDB();

        const embedRemover = new EmbedBuilder()
            .setTitle('📉 PONTOS REMOVIDOS POR INFRAÇÃO')
            .setColor('#e74c3c')
            .setDescription(`👤 **Membro penalizado:** ${usuarioMencionado}\n📉 **Pontos Retirados:** -${qtdRemover}\n✨ **Saldo Atual:** ${dbData.membros[targetId].pontos} pontos\n\n🛡️ **Aplicado por:** ${message.author}`)
            .setTimestamp();

        return message.channel.send({ embeds: [embedRemover] });
    }

    if (command === 'zerar-pontos') {
        if (message.channel.id !== CONFIG.CANAL_PAINEL_STAFF) return message.reply('❌ Comando restrito ao canal privado da Staff!').then(m => setTimeout(() => m.delete(), 5000));

        const usuarioMencionado = message.mentions.members.first();
        if (!usuarioMencionado) {
            return message.reply(`💡 **Modo de Uso:** \`${CONFIG.PREFIXO}zerar-pontos @membro\``);
        }

        const targetId = usuarioMencionado.id;
        dbData.membros[targetId] = { 
            pontos: 0, vendas: 0, recrutamentos: 0, desmanches: 0,
            historico_diario_rec: { seg: 0, ter: 0, qua: 0, qui: 0, sex: 0, sab: 0, dom: 0 }
        };
        salvarDB();

        const embedZerar = new EmbedBuilder()
            .setTitle('🚨 HISTÓRICO DE PRODUTIVIDADE ZERADO')
            .setColor('#000000')
            .setDescription(`👤 **Membro punido:** ${usuarioMencionado}\n⚠️ **Ação:** Todo o histórico de pontos, carros, vendas e recrutamentos foi **APAGADO** por conduta inadequada / fraude.\n\n🛡️ **Aplicado por:** ${message.author}`)
            .setTimestamp();

        return message.channel.send({ embeds: [embedZerar] });
    }

    if (command === 'ranking' || command === 'ranking-geral') {
        let ranking = Object.entries(dbData.membros)
            .filter(r => r[1].pontos && r[1].pontos > 0)
            .sort((a, b) => b[1].pontos - a[1].pontos)
            .slice(0, 10);

        let texto = ranking.map((r, i) => {
            let medalha = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}º`;
            return `${medalha} <@${r[0]}> — **${r[1].pontos} pontos**\n   └ 🚗 *${r[1].desmanches || 0} carros* | 🛒 *${r[1].vendas || 0} vendas* | 🤝 *${r[1].recrutamentos || 0} recs*`;
        }).join('\n\n');
        
        const embedRanking = new EmbedBuilder()
            .setTitle('🏆 RANKING DE PRODUTIVIDADE GERAL')
            .setDescription(texto || 'Nenhum membro pontuou nas atividades ainda!')
            .setColor('#f1c40f')
            .setFooter({ text: 'Pontuação: Carro (+20) | Venda (+30) | Recrutamento (+40)' })
            .setTimestamp();
            
        return message.channel.send({ embeds: [embedRanking] });
    }

    if (command === 'fechar-mes' || command === 'fechar-semana') {
        if (message.channel.id !== CONFIG.CANAL_PAINEL_STAFF) return message.reply('❌ Esse comando só pode ser executado no canal privado da Staff!').then(m => setTimeout(() => m.delete(), 5000));

        let ranking = Object.entries(dbData.membros)
            .filter(r => r[1].pontos && r[1].pontos > 0)
            .sort((a, b) => b[1].pontos - a[1].pontos);

        if (ranking.length === 0) return message.channel.send('❌ Não há ninguém com pontos para fechar o ciclo.');

        let logsBonus = [];
        if (ranking[0]) { dbData.membros[ranking[0][0]].pontos += 500; logsBonus.push(`🥇 **1º Lugar:** <@${ranking[0][0]}> ganhou **+500 pontos**!`); }
        if (ranking[1]) { dbData.membros[ranking[1][0]].pontos += 300; logsBonus.push(`🥈 **2º Lugar:** <@${ranking[1][0]}> ganhou **+300 pontos**!`); }
        if (ranking[2]) { dbData.membros[ranking[2][0]].pontos += 150; logsBonus.push(`🥉 **3º Lugar:** <@${ranking[2][0]}> ganhou **+150 pontos**!`); }

        salvarDB();

        const embedFechamento = new EmbedBuilder()
            .setTitle('🏁 FECHAMENTO DE CICLO & PREMIAÇÕES')
            .setDescription(`O ciclo foi encerrado pela liderança! Os bônus de colocação foram aplicados diretamente no saldo dos vencedores:\n\n${logsBonus.join('\n')}\n\n*Use \`!ranking\` para ver o placar atualizado.*`)
            .setColor('#2ecc71')
            .setTimestamp();

        return message.channel.send({ embeds: [embedFechamento] });
    }

    // ==========================================
    // COMANDOS DE SETUP PARA CANAIS
    // ==========================================
    if (command === 'setup-registro') {
        await message.delete().catch(() => {});
        const embed = new EmbedBuilder()
            .setTitle('📋 REGISTRO')
            .setDescription('Seja muito bem-vindo(a)!\n\nPara liberar o acesso ao servidor, clique no botão abaixo para preencher seu formulário de registro.')
            .setColor('#2b2d31');
        const botao = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('abrir_formulario').setLabel('Iniciar Registro').setStyle(1));
        await message.channel.send({ embeds: [embed], components: [botao] });
    }

    if (command === 'setup-vendas') {
        await message.delete().catch(() => {});
        const embedVendas = new EmbedBuilder()
            .setTitle('🛒 REGISTRO DE VENDAS')
            .setDescription('Realizou alguma venda de armamento, munição ou drogas?\nClique no botão abaixo para registrar a venda.')
            .setColor('#2ecc71');
        const botaoVenda = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('abrir_painel_venda').setLabel('Registrar Venda').setStyle(3));
        await message.channel.send({ embeds: [embedVendas], components: [botaoVenda] });
    }

    if (command === 'setup-desmanche') {
        await message.delete().catch(() => {});
        const embedD = new EmbedBuilder()
            .setTitle('🔨 SISTEMA DE DESMANCHE')
            .setDescription('Cortou ou desmanchou algum veículo na cidade?\nClique no botão abaixo para computar seus pontos (+20 por carro).')
            .setColor('#e67e22');
        const rowD = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('registrar_desmanche_btn').setLabel('🔨 Registrar Desmanche').setStyle(1));
        return message.channel.send({ embeds: [embedD], components: [rowD] });
    }

    if (command === 'setup-bau') {
        await message.delete().catch(() => {});
        const embedBau = new EmbedBuilder()
            .setTitle('📦 CONTROLE DE BAÚ')
            .setDescription('Sempre que for colocar ou retirar qualquer item do baú, você deve registrar por aqui.\n\n⚠️ **Regra:** É obrigatório o envio do print comprovando a ação.')
            .setColor('#f39c12');
        const botoesBau = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('bau_entrada').setLabel('Registrar Entrada').setStyle(3),
            new ButtonBuilder().setCustomId('bau_retirada').setLabel('Registrar Retirada').setStyle(4)
        );
        await message.channel.send({ embeds: [embedBau], components: [botoesBau] });
    }

    if (command === 'setup-punicoes') {
        await message.delete().catch(() => {});
        const canalPainel = await message.guild.channels.fetch(CONFIG.CANAL_PAINEL_STAFF).catch(() => null);
        if (!canalPainel) return message.channel.send(`❌ Erro crítico: Canal do painel staff não configurado.`).catch(() => {});

        const embedPunicoes = new EmbedBuilder()
            .setTitle('🚨 PAINEL DE CONTROLE DE GERENCIAMENTO')
            .setDescription('Utilize os botões abaixo para gerenciar os membros da facção.')
            .setColor('#2b2d31');

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('punir_adv').setLabel('Aplicar ADV').setStyle(3),
            new ButtonBuilder().setCustomId('punir_bl').setLabel('Dar BL Direto').setStyle(4),
            new ButtonBuilder().setCustomId('staff_mudar_cargo').setLabel('🔄 Mudar Cargo + Tag').setStyle(1)
        );
        await canalPainel.send({ embeds: [embedPunicoes], components: [row1] });
    }

    if (command === 'setup-estoque') {
        await message.delete().catch(() => {});
        if (message.channel.id !== CONFIG.CANAL_ESTOQUE) {
            return message.reply('❌ Você precisa usar esse comando direto no canal de estoque!').then(m => setTimeout(() => m.delete(), 5000));
        }

        const embedEstoqueInicial = new EmbedBuilder()
            .setTitle('📦 INVENTÁRIO & ESTOQUE - PAINEL')
            .setDescription('Este canal exibe o balanço geral dos nossos armamentos, drogas e finanças.\n\nClique no botão abaixo para atualizar as quantidades atuais do baú.')
            .setColor('#9b59b6')
            .setTimestamp();

        const rowEstoque = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('staff_atualizar_estoque_btn').setLabel('📦 Atualizar Estoque').setStyle(2)
        );

        await message.channel.send({ embeds: [embedEstoqueInicial], components: [rowEstoque] });
    }
});

// ==========================================
// INTERAÇÕES (BOTÕES E MODAIS)
// ==========================================
client.on('interactionCreate', async (interaction) => {
    try {
        // --- DESMANCHE ---
        if (interaction.isButton() && interaction.customId === 'registrar_desmanche_btn') {
            const modalDesmanche = new ModalBuilder().setCustomId('modal_desmanche').setTitle('🚗 Registrar Desmanche');
            const inputCarro = new TextInputBuilder().setCustomId('d_carro').setLabel('Qual o modelo do carro?').setStyle(TextInputStyle.Short).setRequired(true);
            modalDesmanche.addComponents(new ActionRowBuilder().addComponents(inputCarro));
            await interaction.showModal(modalDesmanche);
        }

        if (interaction.isModalSubmit() && interaction.customId === 'modal_desmanche') {
            const carro = interaction.fields.getTextInputValue('d_carro');
            aguardandoPrint.set(interaction.user.id, { sistema: 'desmanche', carro: carro });
            await interaction.reply({ content: `📬 Modelo **${carro}** anotado!\n\n**Agora, envie o seu PRINT comprovando o desmanche aqui neste canal.**`, ephemeral: true });
        }

        // --- VENDAS ---
        if (interaction.isButton() && interaction.customId === 'abrir_painel_venda') {
            const modalVenda = new ModalBuilder().setCustomId('modal_venda_membro').setTitle('🛒 Registrar Nova Venda');
            const inputItem = new TextInputBuilder().setCustomId('venda_item').setLabel('O que foi vendido e a quantidade?').setStyle(TextInputStyle.Short).setRequired(true);
            const inputValor = new TextInputBuilder().setCustomId('venda_valor').setLabel('Qual foi o valor total recebido?').setStyle(TextInputStyle.Short).setRequired(true);
            const inputComprador = new TextInputBuilder().setCustomId('venda_comprador').setLabel('Quem comprou? (Nome ou ID se souber)').setStyle(TextInputStyle.Short).setRequired(false);
            modalVenda.addComponents(new ActionRowBuilder().addComponents(inputItem), new ActionRowBuilder().addComponents(inputValor), new ActionRowBuilder().addComponents(inputComprador));
            await interaction.showModal(modalVenda);
        }

        if (interaction.isModalSubmit() && interaction.customId === 'modal_venda_membro') {
            const item = interaction.fields.getTextInputValue('venda_item');
            const valor = interaction.fields.getTextInputValue('venda_valor');
            const comprador = interaction.fields.getTextInputValue('venda_comprador') || 'Não Informado';

            adicionarPontosVenda(interaction.user.id);
            await interaction.reply({ content: '✅ Venda registrada! +30 pontos adicionados ao seu perfil.', ephemeral: true });

            const embedRelatorioVenda = new EmbedBuilder()
                .setTitle('💰 NOVA VENDA REGISTRADA')
                .setColor('#2ecc71')
                .setDescription(`👤 **Vendedor:** ${interaction.user}\n📦 **Itens Vendidos:** ${item}\n💵 **Valor Total:** \`${valor}\`\n👤 **Comprador:** ${comprador}\n🎖️ **Soma de Rank:** +30 Pontos Computados`)
                .setTimestamp();
            await enviarLogGeral(interaction.guild, embedRelatorioVenda);
        }

        // --- BAÚ ---
        if (interaction.isButton() && (interaction.customId === 'bau_entrada' || interaction.customId === 'bau_retirada')) {
            const tipo = interaction.customId === 'bau_entrada' ? 'entrada' : 'retirada';
            const modalBau = new ModalBuilder().setCustomId(`modal_bau_${tipo}`).setTitle(tipo === 'entrada' ? '📥 Guardar Itens' : '📤 Retirar Itens');
            const inputItem = new TextInputBuilder().setCustomId('bau_item').setLabel('Quais itens e a quantidade?').setStyle(TextInputStyle.Paragraph).setRequired(true);
            modalBau.addComponents(new ActionRowBuilder().addComponents(inputItem));
            await interaction.showModal(modalBau);
        }

        if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_bau_')) {
            const tipo = interaction.customId.includes('entrada') ? 'entrada' : 'retirada';
            const descricao = interaction.fields.getTextInputValue('bau_item');
            aguardandoPrint.set(interaction.user.id, { sistema: 'bau', tipo: tipo, descricao: descricao });
            await interaction.reply({ content: `📬 Anotado! **Envie o print** mostrando o inventário no canal agora para finalizar.`, ephemeral: true });
        }

        // --- FORMULÁRIO E REGISTRO ---
        if (interaction.isButton() && interaction.customId === 'abrir_formulario') {
            if (interaction.member.roles.cache.has(CONFIG.CARGO_MEMBRO)) return interaction.reply({ content: '🧠 Você já está registrado e aprovado!', ephemeral: true });
            
            const modal = new ModalBuilder().setCustomId('formulario_registro').setTitle('Registro - ALVARÁ');
            const campoNome = new TextInputBuilder().setCustomId('input_nome').setLabel('Qual é o seu nome/apelido?').setStyle(TextInputStyle.Short).setRequired(true);
            const campoId = new TextInputBuilder().setCustomId('input_id').setLabel('Qual é o seu ID na cidade?').setStyle(TextInputStyle.Short).setRequired(true);
            const campoCargo = new TextInputBuilder().setCustomId('input_cargo').setLabel('Qual cargo você quer?').setStyle(TextInputStyle.Short).setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(campoNome), new ActionRowBuilder().addComponents(campoId), new ActionRowBuilder().addComponents(campoCargo));
            await interaction.showModal(modal);
        }

        if (interaction.isModalSubmit() && interaction.customId === 'formulario_registro') {
            const nome = interaction.fields.getTextInputValue('input_nome');
            const idJogo = interaction.fields.getTextInputValue('input_id');
            const cargoPedido = interaction.fields.getTextInputValue('input_cargo');

            await interaction.reply({ content: '✅ Seu formulário foi enviado com sucesso! Aguarde a aprovação da nossa Staff.', ephemeral: true });

            const canalStaff = await interaction.guild.channels.fetch(CONFIG.CANAL_STAFF_APROVACAO).catch(() => null);
            if (canalStaff) {
                const embedStaff = new EmbedBuilder()
                    .setTitle('⏳ NOVO REGISTRO AGUARDANDO APROVAÇÃO')
                    .setDescription(`👤 **Usuário:** ${interaction.user}\n📝 **Nome:** ${nome}\n🆔 **ID informado:** ${idJogo}\n⚔️ **Cargo desejado:** ${cargoPedido}`)
                    .setColor('#f1c40f');

                const botoesStaff = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`aceitar_${interaction.user.id}_${nome}_${cargoPedido}_${idJogo}`).setLabel('Aceitar').setStyle(2),
                    new ButtonBuilder().setCustomId(`recusar_${interaction.user.id}`).setLabel('Recusar').setStyle(4)
                );
                await canalStaff.send({ embeds: [embedStaff], components: [botoesStaff] });
            }
        }

        if (interaction.isButton() && interaction.customId.startsWith('aceitar_')) {
            const partes = interaction.customId.split('_');
            const idUsuario = partes[1];
            const nomeMembro = partes[2];
            const nomeCargo = partes[3];
            const idDoJogo = partes[4];

            const cargoBase = validarConfiguracaoCargo(interaction.guild);
            if (!cargoBase) return interaction.reply({ content: '❌ Erro crítico: O cargo de membro não foi encontrado! Verifique se configurou o ID.', ephemeral: true });

            const membroAlvo = await interaction.guild.members.fetch(idUsuario).catch(() => null);
            if (!membroAlvo) return interaction.reply({ content: '❌ Este usuário não foi encontrado no servidor.', ephemeral: true });

            await membroAlvo.roles.add(cargoBase).catch(() => {});
            const cargoEspecificoId = CONFIG.CARGOS_HIERARQUIA[String(nomeCargo).toLowerCase().trim()];
            if (cargoEspecificoId) await membroAlvo.roles.add(cargoEspecificoId).catch(() => {});

            const formatoTag = `[${nomeCargo}] ${nomeMembro} [${idDoJogo}]`;
            await membroAlvo.setNickname(formatoTag.slice(0, 32)).catch(() => {});

            adicionarPontosRecrutamento(interaction.user.id);

            const embedAceitoStaff = EmbedBuilder.from(interaction.message.embeds[0]).setColor('#2ecc71').setTitle('✅ REGISTRO APROVADO').addFields([{ name: 'Resultado', value: `Aprovado por: ${interaction.user} (+40 pts)` }]);
            await interaction.update({ embeds: [embedAceitoStaff], components: [] });

            const canalAprovados = await interaction.guild.channels.fetch(CONFIG.CANAL_APROVADOS).catch(() => null);
            if (canalAprovados) {
                const embedAprovados = new EmbedBuilder().setTitle('🎉 NOVO MEMBRO APROVADO!').setDescription(`Usuário: ${membroAlvo}\n✓ **Aprovado por:** ${interaction.user}`).setColor('#2ecc71').setTimestamp();
                await canalAprovados.send({ content: `🟢 ${membroAlvo} foi aprovado!`, embeds: [embedAprovados] });
            }
        }

        if (interaction.isButton() && interaction.customId.startsWith('recusar_')) {
            const idUsuario = interaction.customId.split('_')[1];
            const membroAlvo = await interaction.guild.members.fetch(idUsuario).catch(() => null);
            
            const embedRecusadoStaff = EmbedBuilder.from(interaction.message.embeds[0]).setColor('#e74c3c').setTitle('❌ REGISTRO RECUSADO').addFields([{ name: 'Resultado', value: `Recusado por: ${interaction.user}` }]);
            await interaction.update({ embeds: [embedRecusadoStaff], components: [] });

            const canalRecusados = await interaction.guild.channels.fetch(CONFIG.CANAL_RECUSADOS).catch(() => null);
            if (canalRecusados && membroAlvo) {
                const embedRecusados = new EmbedBuilder().setTitle('❌ REGISTRO RECUSADO').setDescription(`⚠️ **Recusado por:** ${interaction.user}`).setColor('#e74c3c').setTimestamp();
                await canalRecusados.send({ content: `🔴 <@${idUsuario}> foi recusado.`, embeds: [embedRecusados] });
            }
        }

        // --- ESTOQUE DA STAFF (AGORA FICA NO CANAL DE ESTOQUE) ---
        if (interaction.isButton() && interaction.customId === 'staff_atualizar_estoque_btn') {
            const modalEstoque = new ModalBuilder().setCustomId('modal_atualizar_estoque').setTitle('📦 Atualizar Estoque Privado');
            const inputArmas = new TextInputBuilder().setCustomId('est_armas').setLabel('Armas em Estoque').setStyle(TextInputStyle.Paragraph).setRequired(true);
            const inputDrogas = new TextInputBuilder().setCustomId('est_drogas').setLabel('Drogas / Munições').setStyle(TextInputStyle.Paragraph).setRequired(true);
            const inputGrana = new TextInputBuilder().setCustomId('est_dinheiro').setLabel('Dinheiro do Baú').setStyle(TextInputStyle.Short).setRequired(true);

            modalEstoque.addComponents(new ActionRowBuilder().addComponents(inputArmas), new ActionRowBuilder().addComponents(inputDrogas), new ActionRowBuilder().addComponents(inputGrana));
            await interaction.showModal(modalEstoque);
        }

        if (interaction.isModalSubmit() && interaction.customId === 'modal_atualizar_estoque') {
            const armas = interaction.fields.getTextInputValue('est_armas');
            const drogas = interaction.fields.getTextInputValue('est_drogas');
            const grana = interaction.fields.getTextInputValue('est_dinheiro');

            // Deleta a mensagem antiga com os botões
            await interaction.message.delete().catch(() => {});

            const embedEstoqueAtual = new EmbedBuilder()
                .setTitle('📦 INVENTÁRIO & ESTOQUE ATUAL - PRIVADO')
                .setColor('#9b59b6')
                .addFields(
                    { name: '🔫 ARMAS & EQUIPAMENTOS', value: `\`\`\`\n${armas}\n\`\`\`` },
                    { name: '💊 DROGAS & MUNIÇÕES', value: `\`\`\`\n${drogas}\n\`\`\`` },
                    { name: '💵 DINHEIRO TOTAL EM CAIXA', value: `\`\`\`\n${grana}\n\`\`\`` }
                )
                .setTimestamp();

            // Recria o botão logo abaixo do novo estoque
            const rowEstoque = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('staff_atualizar_estoque_btn').setLabel('📦 Atualizar Estoque').setStyle(2)
            );

            await interaction.channel.send({ embeds: [embedEstoqueAtual], components: [rowEstoque] });
            await interaction.reply({ content: '✅ Painel de estoque atualizado!', ephemeral: true });
        }

        // --- MUDAR CARGO / TAG ---
        if (interaction.isButton() && interaction.customId === 'staff_mudar_cargo') {
            const modalCargo = new ModalBuilder().setCustomId('modal_coletar_dados_mudar_cargo').setTitle('Mudar Cargo/Tag');
            const inputUser = new TextInputBuilder().setCustomId('cargo_user_id').setLabel('ID do Discord do membro (apenas números)').setStyle(TextInputStyle.Short).setRequired(true);
            const inputCargo = new TextInputBuilder().setCustomId('cargo_novo_nome').setLabel('Novo nome do cargo (Ex: 02, Elite)').setStyle(TextInputStyle.Short).setRequired(true);
            
            modalCargo.addComponents(new ActionRowBuilder().addComponents(inputUser), new ActionRowBuilder().addComponents(inputCargo));
            await interaction.showModal(modalCargo);
        }

        if (interaction.isModalSubmit() && interaction.customId === 'modal_coletar_dados_mudar_cargo') {
            const userId = interaction.fields.getTextInputValue('cargo_user_id');
            const novoCargoNome = interaction.fields.getTextInputValue('cargo_novo_nome');
            const membro = await interaction.guild.members.fetch(userId).catch(() => null);

            if (!membro) return interaction.reply({ content: '❌ Membro não encontrado!', ephemeral: true });

            const cargoId = CONFIG.CARGOS_HIERARQUIA[novoCargoNome.toLowerCase()];
            if (cargoId) {
                await membro.roles.add(cargoId).catch(() => {});
                await membro.setNickname(`[${novoCargoNome.toUpperCase()}] ${membro.displayName.split('] ')[1] || membro.displayName}`).catch(() => {});
                await interaction.reply({ content: `✅ Cargo alterado para ${novoCargoNome} com sucesso!`, ephemeral: true });
            } else {
                await interaction.reply({ content: '❌ Cargo não encontrado na hierarquia configurada.', ephemeral: true });
            }
        }
    } catch (e) { console.error("Erro na interação:", e); }
});

// ==========================================
// SERVIDOR PARA MANTER O BOT ONLINE 24H (RENDER)
// ==========================================
const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('ALVARÁ está ONLINE e monitorando!'));
app.listen(process.env.PORT || 3000, () => {
    console.log('Servidor web iniciado para Uptime na porta ' + (process.env.PORT || 3000));
});

client.login(TOKEN);