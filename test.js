// index.js - Ponto de entrada principal do bot

const { 
  Client, 
  GatewayIntentBits, 
  Partials, 
  Collection, 
  REST, 
  Routes,
  ApplicationCommandOptionType,
  EmbedBuilder
} = require('discord.js');

// Importando diretamente a classe YukufyClient
const { YukufyClient } = require('./main.js');

// Configurações do bot
const config = {
  token: process.env.BOT_TOKEN || '',
  clientId: process.env.CLIENT_ID || '',
  guildId: process.env.GUILD_ID, // Opcional, para comandos específicos de servidor
  spotifyClientId: process.env.SPOTIFY_CLIENT_ID || '',
  spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET || ''
};

// Intents necessários para o bot
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.User,
    Partials.GuildMember
  ]
});

// Inicializando coleções
client.commands = new Collection();

// Status e variáveis globais
let isReady = false;

// Inicializando o cliente Yukufy
const yukufy = new YukufyClient(client, {
  api: {
    clientId: config.spotifyClientId,
    clientSecret: config.spotifyClientSecret
  },
  player: {
    defaultVolume: 75,
    leaveOnEmptyQueue: true,
    leaveOnEmptyQueueCooldown: 30000,
    autoPlayRelated: true
  }
});

// Definindo os comandos slash
const commands = [
  {
    name: 'play',
    description: 'Toca uma música no canal de voz',
    options: [
      {
        name: 'query',
        type: ApplicationCommandOptionType.String,
        description: 'Nome da música ou URL',
        required: true
      },
      {
        name: 'source',
        type: ApplicationCommandOptionType.String,
        description: 'Fonte da música (spotify, soundcloud)',
        required: false,
        choices: [
          { name: 'Spotify', value: 'spotify' },
          { name: 'SoundCloud', value: 'soundcloud' }
        ]
      }
    ]
  },
  {
    name: 'pause',
    description: 'Pausa a reprodução atual'
  },
  {
    name: 'resume',
    description: 'Retoma a reprodução pausada'
  },
  {
    name: 'skip',
    description: 'Pula para a próxima música na fila'
  },
  {
    name: 'stop',
    description: 'Para a reprodução e limpa a fila'
  },
  {
    name: 'volume',
    description: 'Ajusta o volume da reprodução',
    options: [
      {
        name: 'level',
        type: ApplicationCommandOptionType.Integer,
        description: 'Nível de volume (0-100)',
        required: true,
        min_value: 0,
        max_value: 100
      }
    ]
  },
  {
    name: 'queue',
    description: 'Mostra a fila de músicas atual'
  },
  {
    name: 'nowplaying',
    description: 'Mostra informações sobre a música atual'
  },
  {
    name: 'loop',
    description: 'Define o modo de repetição',
    options: [
      {
        name: 'mode',
        type: ApplicationCommandOptionType.Integer,
        description: 'Modo de repetição',
        required: true,
        choices: [
          { name: 'Desativado', value: 0 },
          { name: 'Música atual', value: 1 },
          { name: 'Fila completa', value: 2 }
        ]
      }
    ]
  },
  {
    name: 'shuffle',
    description: 'Embaralha a fila de reprodução'
  },
  {
    name: 'search',
    description: 'Pesquisa músicas em diferentes plataformas',
    options: [
      {
        name: 'query',
        type: ApplicationCommandOptionType.String,
        description: 'Termo de pesquisa',
        required: true
      },
      {
        name: 'source',
        type: ApplicationCommandOptionType.String,
        description: 'Plataforma de música',
        required: false,
        choices: [
          { name: 'Spotify', value: 'spotify' },
          { name: 'SoundCloud', value: 'soundcloud' }
        ]
      }
    ]
  },
  {
    name: 'remove',
    description: 'Remove uma música da fila',
    options: [
      {
        name: 'position',
        type: ApplicationCommandOptionType.Integer,
        description: 'Posição na fila (a partir de 1)',
        required: true,
        min_value: 1
      }
    ]
  },
  {
    name: 'lyrics',
    description: 'Busca a letra da música atual ou especificada',
    options: [
      {
        name: 'query',
        type: ApplicationCommandOptionType.String,
        description: 'Nome da música (opcional)',
        required: false
      }
    ]
  },
  {
    name: 'join',
    description: 'Conecta ao seu canal de voz atual'
  },
  {
    name: 'leave',
    description: 'Desconecta do canal de voz'
  },
  {
    name: 'related',
    description: 'Adiciona músicas relacionadas à fila',
    options: [
      {
        name: 'count',
        type: ApplicationCommandOptionType.Integer,
        description: 'Número de músicas para adicionar (1-5)',
        required: false,
        min_value: 1,
        max_value: 5
      }
    ]
  },
  {
    name: 'move',
    description: 'Move uma música para outra posição na fila',
    options: [
      {
        name: 'from',
        type: ApplicationCommandOptionType.Integer,
        description: 'Posição atual da música (a partir de 1)',
        required: true,
        min_value: 1
      },
      {
        name: 'to',
        type: ApplicationCommandOptionType.Integer,
        description: 'Nova posição da música (a partir de 1)',
        required: true,
        min_value: 1
      }
    ]
  }
];

// Registra os comandos no Discord
async function registerCommands() {
  try {
    console.log('Iniciando registro de comandos slash...');
    
    const rest = new REST({ version: '10' }).setToken(config.token);
    
    // Registrar comandos globalmente ou em um servidor específico
    const route = config.guildId 
      ? Routes.applicationGuildCommands(config.clientId, config.guildId)
      : Routes.applicationCommands(config.clientId);
    
    await rest.put(route, { body: commands });
    
    console.log('Comandos slash registrados com sucesso!');
  } catch (error) {
    console.error('Erro ao registrar comandos:', error);
  }
}

// Função para criar embeds consistentes
function createEmbed({ title, description, color = '#8A2BE2', fields = [], thumbnail = null, footer = null }) {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp();
  
  if (fields.length) embed.addFields(fields);
  if (thumbnail) embed.setThumbnail(thumbnail);
  if (footer) embed.setFooter(footer);
  
  return embed;
}

// Verificação de permissões e requisitos
function checkVoiceRequirements(interaction) {
  if (!interaction.member.voice.channel) {
    interaction.reply({
      embeds: [createEmbed({
        title: '❌ Erro',
        description: 'Você precisa estar em um canal de voz para usar este comando.',
        color: '#FF0000'
      })],
      ephemeral: true
    });
    return false;
  }
  
  // Verifica se o bot tem permissão para se conectar e falar
  const permissions = interaction.member.voice.channel.permissionsFor(interaction.client.user);
  if (!permissions.has('Connect') || !permissions.has('Speak')) {
    interaction.reply({
      embeds: [createEmbed({
        title: '❌ Erro de Permissão',
        description: 'Não tenho permissão para me conectar ou falar nesse canal de voz.',
        color: '#FF0000'
      })],
      ephemeral: true
    });
    return false;
  }
  
  return true;
}

// Controladores de comandos
const commandHandlers = {
  // Comando play
  async play(interaction) {
    try {
      if (!checkVoiceRequirements(interaction)) return;
      
      await interaction.deferReply();
      
      const query = interaction.options.getString('query');
      const source = interaction.options.getString('source') || 'spotify';
      const voiceChannel = interaction.member.voice.channel;
      
      const track = await yukufy.play({
        query,
        voiceChannel,
        textChannel: interaction.channel,
        member: interaction.member,
        source
      });
      
      const embed = createEmbed({
        title: '🎵 Música adicionada à fila',
        description: `**${track.title}**\nArtista: ${track.artist}`,
        color: '#8A2BE2',
        thumbnail: track.thumbnail,
        fields: [
          { name: 'Duração', value: track.duration, inline: true },
          { name: 'Fonte', value: track.source, inline: true }
        ]
      });
      
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Erro no comando play:', error);
      await interaction.editReply({
        embeds: [createEmbed({
          title: '❌ Erro',
          description: `Não foi possível reproduzir a música: ${error.message}`,
          color: '#FF0000'
        })]
      });
    }
  },
  
  // Comando pause
  async pause(interaction) {
    try {
      if (!checkVoiceRequirements(interaction)) return;
      
      const guildId = interaction.guildId;
      const result = await yukufy.pause(guildId);
      
      if (result.status === 'alreadyPaused') {
        await interaction.reply({
          embeds: [createEmbed({
            title: '⏸️ Música já pausada',
            description: 'A reprodução já está pausada.',
            color: '#FFA500'
          })]
        });
      } else {
        await interaction.reply({
          embeds: [createEmbed({
            title: '⏸️ Música pausada',
            description: 'A reprodução foi pausada. Use `/resume` para continuar.',
            color: '#8A2BE2'
          })]
        });
      }
    } catch (error) {
      console.error('Erro no comando pause:', error);
      await interaction.reply({
        embeds: [createEmbed({
          title: '❌ Erro',
          description: `Não foi possível pausar: ${error.message}`,
          color: '#FF0000'
        })],
        ephemeral: true
      });
    }
  },
  
  // Comando resume
  async resume(interaction) {
    try {
      if (!checkVoiceRequirements(interaction)) return;
      
      const guildId = interaction.guildId;
      const result = await yukufy.resume(guildId);
      
      if (result.status === 'alreadyPlaying') {
        await interaction.reply({
          embeds: [createEmbed({
            title: '▶️ Já em reprodução',
            description: 'A música já está sendo reproduzida.',
            color: '#FFA500'
          })]
        });
      } else {
        await interaction.reply({
          embeds: [createEmbed({
            title: '▶️ Reprodução retomada',
            description: 'A reprodução foi retomada.',
            color: '#8A2BE2'
          })]
        });
      }
    } catch (error) {
      console.error('Erro no comando resume:', error);
      await interaction.reply({
        embeds: [createEmbed({
          title: '❌ Erro',
          description: `Não foi possível retomar: ${error.message}`,
          color: '#FF0000'
        })],
        ephemeral: true
      });
    }
  },
  
  // Comando skip
  async skip(interaction) {
    try {
      if (!checkVoiceRequirements(interaction)) return;
      
      const guildId = interaction.guildId;
      await yukufy.skip(guildId);
      
      await interaction.reply({
        embeds: [createEmbed({
          title: '⏭️ Música pulada',
          description: 'Pulando para a próxima música na fila.',
          color: '#8A2BE2'
        })]
      });
    } catch (error) {
      console.error('Erro no comando skip:', error);
      await interaction.reply({
        embeds: [createEmbed({
          title: '❌ Erro',
          description: `Não foi possível pular: ${error.message}`,
          color: '#FF0000'
        })],
        ephemeral: true
      });
    }
  },
  
  // Comando stop
  async stop(interaction) {
    try {
      if (!checkVoiceRequirements(interaction)) return;
      
      const guildId = interaction.guildId;
      await yukufy.stop(guildId);
      
      await interaction.reply({
        embeds: [createEmbed({
          title: '🛑 Reprodução parada',
          description: 'A reprodução foi interrompida e a fila foi limpa.',
          color: '#8A2BE2'
        })]
      });
    } catch (error) {
      console.error('Erro no comando stop:', error);
      await interaction.reply({
        embeds: [createEmbed({
          title: '❌ Erro',
          description: `Não foi possível parar: ${error.message}`,
          color: '#FF0000'
        })],
        ephemeral: true
      });
    }
  },
  
  // Comando volume
  async volume(interaction) {
    try {
      if (!checkVoiceRequirements(interaction)) return;
      
      const level = interaction.options.getInteger('level');
      const guildId = interaction.guildId;
      
      await yukufy.setVolume(guildId, level);
      
      await interaction.reply({
        embeds: [createEmbed({
          title: '🔊 Volume ajustado',
          description: `O volume foi definido para ${level}%.`,
          color: '#8A2BE2'
        })]
      });
    } catch (error) {
      console.error('Erro no comando volume:', error);
      await interaction.reply({
        embeds: [createEmbed({
          title: '❌ Erro',
          description: `Não foi possível ajustar o volume: ${error.message}`,
          color: '#FF0000'
        })],
        ephemeral: true
      });
    }
  },
  
  // Comando queue
  async queue(interaction) {
    try {
      const guildId = interaction.guildId;
      const queueData = await yukufy.getQueue(guildId);
      
      if (!queueData.queue || queueData.queue.length === 0) {
        return interaction.reply({
          embeds: [createEmbed({
            title: '📋 Fila vazia',
            description: 'Não há músicas na fila de reprodução.',
            color: '#FFA500'
          })]
        });
      }
      
      // Formata a fila para exibição
      let queueString = '';
      queueData.queue.forEach((track, index) => {
        queueString += `**${index + 1}.** ${track.title} - ${track.artist} | ${track.duration}\n`;
        
        // Limita o tamanho para evitar exceder o limite do Discord
        if (queueString.length > 3500) {
          queueString += `\n*...e mais ${queueData.queue.length - index - 1} músicas*`;
          return;
        }
      });
      
      // Informações sobre a música atual
      const currentTrack = queueData.current;
      const currentString = currentTrack 
        ? `**Tocando agora:** ${currentTrack.title} - ${currentTrack.artist} | ${currentTrack.duration}`
        : 'Nenhuma música em reprodução.';
      
      // Informações sobre o modo de loop
      const loopMode = queueData.loopMode;
      let loopString = 'Desativado';
      if (loopMode === 1) loopString = 'Música atual';
      if (loopMode === 2) loopString = 'Fila completa';
      
      await interaction.reply({
        embeds: [createEmbed({
          title: '📋 Fila de reprodução',
          description: `${currentString}\n\n${queueString}`,
          color: '#8A2BE2',
          fields: [
            { name: 'Total de músicas', value: `${queueData.queue.length}`, inline: true },
            { name: 'Modo de repetição', value: loopString, inline: true }
          ]
        })]
      });
    } catch (error) {
      console.error('Erro no comando queue:', error);
      await interaction.reply({
        embeds: [createEmbed({
          title: '❌ Erro',
          description: `Não foi possível obter a fila: ${error.message}`,
          color: '#FF0000'
        })],
        ephemeral: true
      });
    }
  },
  
  // Comando nowplaying
  async nowplaying(interaction) {
    try {
      const guildId = interaction.guildId;
      const nowPlaying = await yukufy.getNowPlaying(guildId);
      
      if (!nowPlaying) {
        return interaction.reply({
          embeds: [createEmbed({
            title: '🎵 Sem reprodução',
            description: 'Não há nenhuma música sendo reproduzida no momento.',
            color: '#FFA500'
          })]
        });
      }
      
      // Cria uma barra de progresso
      const progressBarLength = 15;
      const progress = nowPlaying.progress || 0;
      const filled = Math.round((progress / 100) * progressBarLength);
      const progressBar = '▓'.repeat(filled) + '░'.repeat(progressBarLength - filled);
      
      await interaction.reply({
        embeds: [createEmbed({
          title: '🎵 Tocando agora',
          description: `**${nowPlaying.title}**\nArtista: ${nowPlaying.artist}`,
          color: '#8A2BE2',
          thumbnail: nowPlaying.thumbnail,
          fields: [
            { name: 'Duração', value: nowPlaying.elapsedTime, inline: true },
            { name: 'Fonte', value: nowPlaying.source, inline: true },
            { name: 'Adicionado por', value: `<@${nowPlaying.member.id}>`, inline: true },
            { name: 'Progresso', value: `${progressBar} ${progress.toFixed(1)}%` }
          ]
        })]
      });
    } catch (error) {
      console.error('Erro no comando nowplaying:', error);
      await interaction.reply({
        embeds: [createEmbed({
          title: '❌ Erro',
          description: `Não foi possível obter informações: ${error.message}`,
          color: '#FF0000'
        })],
        ephemeral: true
      });
    }
  },
  
  // Comando loop
  async loop(interaction) {
    try {
      if (!checkVoiceRequirements(interaction)) return;
      
      const mode = interaction.options.getInteger('mode');
      const guildId = interaction.guildId;
      
      await yukufy.setLoopMode(guildId, mode);
      
      const modeNames = ['desativado', 'música atual', 'fila completa'];
      
      await interaction.reply({
        embeds: [createEmbed({
          title: '🔄 Modo de repetição',
          description: `Modo de repetição definido para: **${modeNames[mode]}**`,
          color: '#8A2BE2'
        })]
      });
    } catch (error) {
      console.error('Erro no comando loop:', error);
      await interaction.reply({
        embeds: [createEmbed({
          title: '❌ Erro',
          description: `Não foi possível definir o modo de repetição: ${error.message}`,
          color: '#FF0000'
        })],
        ephemeral: true
      });
    }
  },
  
  // Comando shuffle
  async shuffle(interaction) {
    try {
      if (!checkVoiceRequirements(interaction)) return;
      
      const guildId = interaction.guildId;
      const shuffledQueue = await yukufy.shuffle(guildId);
      
      if (!shuffledQueue || shuffledQueue.length === 0) {
        return interaction.reply({
          embeds: [createEmbed({
            title: '🔀 Fila vazia',
            description: 'Não há músicas suficientes na fila para embaralhar.',
            color: '#FFA500'
          })]
        });
      }
      
      await interaction.reply({
        embeds: [createEmbed({
          title: '🔀 Fila embaralhada',
          description: `A fila de reprodução com ${shuffledQueue.length} músicas foi embaralhada.`,
          color: '#8A2BE2'
        })]
      });
    } catch (error) {
      console.error('Erro no comando shuffle:', error);
      await interaction.reply({
        embeds: [createEmbed({
          title: '❌ Erro',
          description: `Não foi possível embaralhar a fila: ${error.message}`,
          color: '#FF0000'
        })],
        ephemeral: true
      });
    }
  },
  
  // Comando search
  async search(interaction) {
    try {
      await interaction.deferReply();
      
      const query = interaction.options.getString('query');
      const source = interaction.options.getString('source') || 'spotify';
      
      const searchResults = await yukufy.search(query, source);
      
      if (!searchResults || searchResults.length === 0) {
        return interaction.editReply({
          embeds: [createEmbed({
            title: '🔍 Sem resultados',
            description: `Nenhum resultado encontrado para "${query}" no ${source}.`,
            color: '#FFA500'
          })]
        });
      }
      
      // Limita a 10 resultados
      const results = searchResults.slice(0, 10);
      
      // Formata os resultados
      const resultsList = results.map((track, index) => 
        `**${index + 1}.** ${track.title} - ${track.artist} | ${track.duration}`
      ).join('\n');
      
      const sourceIcons = {
        'spotify': '🟢',
        'soundcloud': '🟠'
      };
      
      await interaction.editReply({
        embeds: [createEmbed({
          title: `🔍 Resultados da pesquisa ${sourceIcons[source] || ''}`,
          description: `Resultados para "${query}" no ${source}:\n\n${resultsList}\n\nUse \`/play ${query}\` para reproduzir o primeiro resultado.`,
          color: '#8A2BE2'
        })]
      });
    } catch (error) {
      console.error('Erro no comando search:', error);
      await interaction.editReply({
        embeds: [createEmbed({
          title: '❌ Erro',
          description: `Não foi possível realizar a pesquisa: ${error.message}`,
          color: '#FF0000'
        })]
      });
    }
  },
  
  // Comando remove
  async remove(interaction) {
    try {
      if (!checkVoiceRequirements(interaction)) return;
      
      const position = interaction.options.getInteger('position');
      const guildId = interaction.guildId;
      
      // Ajusta para índice 0-based
      const index = position - 1;
      
      const removedTrack = await yukufy.remove(guildId, index);
      
      await interaction.reply({
        embeds: [createEmbed({
          title: '🗑️ Música removida',
          description: `Removido da fila: **${removedTrack.title}** - ${removedTrack.artist}`,
          color: '#8A2BE2'
        })]
      });
    } catch (error) {
      console.error('Erro no comando remove:', error);
      await interaction.reply({
        embeds: [createEmbed({
          title: '❌ Erro',
          description: `Não foi possível remover a música: ${error.message}`,
          color: '#FF0000'
        })],
        ephemeral: true
      });
    }
  },
  
  // Comando lyrics
  async lyrics(interaction) {
    try {
      await interaction.deferReply();
      
      const query = interaction.options.getString('query');
      const guildId = interaction.guildId;
      
      const lyricsResult = await yukufy.lyrics(query, guildId);
      
      if (!lyricsResult || !lyricsResult.lyrics) {
        return interaction.editReply({
          embeds: [createEmbed({
            title: '🎵 Letra não encontrada',
            description: 'Não foi possível encontrar a letra desta música.',
            color: '#FFA500'
          })]
        });
      }
      
      const { lyrics, title, artist, thumbnail, url } = lyricsResult;
      
      // Verifica se a letra é muito longa
      if (lyrics.length > 4000) {
        // Trunca a letra e adiciona uma nota
        const truncatedLyrics = lyrics.substring(0, 3900) + '...\n\n*Letra completa muito longa para exibir.*';
        
        return interaction.editReply({
          embeds: [createEmbed({
            title: `🎵 Letra: ${title}`,
            description: truncatedLyrics,
            color: '#8A2BE2',
            thumbnail: thumbnail,
            fields: [
              { name: 'Artista', value: artist, inline: true },
              { name: 'Link', value: `[Ver letra completa](${url})`, inline: true }
            ]
          })]
        });
      }
      
      await interaction.editReply({
        embeds: [createEmbed({
          title: `🎵 Letra: ${title}`,
          description: lyrics,
          color: '#8A2BE2',
          thumbnail: thumbnail,
          fields: [
            { name: 'Artista', value: artist, inline: true },
            { name: 'Link', value: `[Ver no Genius](${url})`, inline: true }
          ]
        })]
      });
    } catch (error) {
      console.error('Erro no comando lyrics:', error);
      await interaction.editReply({
        embeds: [createEmbed({
          title: '❌ Erro',
          description: `Não foi possível obter a letra: ${error.message}`,
          color: '#FF0000'
        })]
      });
    }
  },
  
  // Comando join
  async join(interaction) {
    try {
      if (!checkVoiceRequirements(interaction)) return;
      
      const voiceChannel = interaction.member.voice.channel;
      
      // O método _connect é interno, então usaremos play com uma verificação
      const connected = await yukufy._connect(voiceChannel);
      
      await interaction.reply({
        embeds: [createEmbed({
          title: '🔊 Conectado',
          description: `Conectado ao canal de voz: **${voiceChannel.name}**`,
          color: '#8A2BE2'
        })]
      });
    } catch (error) {
      console.error('Erro no comando join:', error);
      await interaction.reply({
        embeds: [createEmbed({
          title: '❌ Erro',
          description: `Não foi possível conectar ao canal: ${error.message}`,
          color: '#FF0000'
        })],
        ephemeral: true
      });
    }
  },
  
  // Comando leave
  async leave(interaction) {
    try {
      if (!interaction.member.voice.channel) {
        return interaction.reply({
          embeds: [createEmbed({
            title: '❌ Erro',
            description: 'Você precisa estar em um canal de voz para usar este comando.',
            color: '#FF0000'
          })],
          ephemeral: true
        });
      }
      
      const guildId = interaction.guildId;
      await yukufy.leave(guildId);
      
      await interaction.reply({
        embeds: [createEmbed({
          title: '👋 Desconectado',
          description: 'Desconectado do canal de voz.',
          color: '#8A2BE2'
        })]
      });
    } catch (error) {
      console.error('Erro no comando leave:', error);
      await interaction.reply({
        embeds: [createEmbed({
          title: '❌ Erro',
          description: `Não foi possível desconectar: ${error.message}`,
          color: '#FF0000'
        })],
        ephemeral: true
      });
    }
  },
  
  // Comando related
  async related(interaction) {
    try {
      if (!checkVoiceRequirements(interaction)) return;
      
      await interaction.deferReply();
      
      const count = interaction.options.getInteger('count') || 3;
      const guildId = interaction.guildId;
      
      const addedTracks = await yukufy.addRelatedTracks(guildId, count);
      
      if (!addedTracks || addedTracks.length === 0) {
        return interaction.editReply({
          embeds: [createEmbed({
            title: '❌ Sem músicas relacionadas',
            description: 'Não foi possível encontrar músicas relacionadas.',
            color: '#FFA500'
          })]
        });
      }
      
      // Formata a lista de músicas adicionadas
      const tracksList = addedTracks.map((track, index) => 
        `**${index + 1}.** ${track.title} - ${track.artist}`
      ).join('\n');
      
      await interaction.editReply({
        embeds: [createEmbed({
          title: '🔄 Músicas relacionadas adicionadas',
          description: `Adicionadas ${addedTracks.length} músicas relacionadas à fila:\n\n${tracksList}`,
          color: '#8A2BE2'
        })]
      });
    } catch (error) {
      console.error('Erro no comando related:', error);
      await interaction.editReply({
        embeds: [createEmbed({
          title: '❌ Erro',
          description: `Não foi possível adicionar músicas relacionadas: ${error.message}`,
          color: '#FF0000'
        })]
      });
    }
  },
  
  // Comando move
  async move(interaction) {
    try {
      if (!checkVoiceRequirements(interaction)) return;
      
      const fromPosition = interaction.options.getInteger('from');
      const toPosition = interaction.options.getInteger('to');
      
      const guildId = interaction.guildId;
      
      // Ajusta para índices 0-based
      const fromIndex = fromPosition - 1;
      const toIndex = toPosition - 1;
      
      const result = await yukufy.moveSong(guildId, fromIndex, toIndex);
      
      await interaction.reply({
        embeds: [createEmbed({
          title: '🔄 Música movida',
          description: `**${result.track.title}** foi movida da posição ${fromPosition} para ${toPosition}.`,
          color: '#8A2BE2'
        })]
      });
    } catch (error) {
      console.error('Erro no comando move:', error);
      await interaction.reply({
        embeds: [createEmbed({
          title: '❌ Erro',
          description: `Não foi possível mover a música: ${error.message}`,
          color: '#FF0000'
        })],
        ephemeral: true
      });
    }
  }
};

// Manipulador principal de interações
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;
  
  // Verifica se o bot está pronto
  if (!isReady) {
    return interaction.reply({
      embeds: [createEmbed({
        title: '🔄 Inicializando',
        description: 'O bot ainda está inicializando, tente novamente em alguns segundos.',
        color: '#FFA500'
      })],
      ephemeral: true
    });
  }
  
  const { commandName } = interaction;
  
  // Executa o manipulador correspondente
  if (commandHandlers[commandName]) {
    try {
      await commandHandlers[commandName](interaction);
    } catch (error) {
      console.error(`Erro ao executar o comando ${commandName}:`, error);
      
      // Responde apenas se a interação ainda não foi respondida
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          embeds: [createEmbed({
            title: '❌ Erro inesperado',
            description: 'Ocorreu um erro ao executar o comando.',
            color: '#FF0000'
          })],
          ephemeral: true
        });
      } else if (interaction.deferred && !interaction.replied) {
        await interaction.editReply({
          embeds: [createEmbed({
            title: '❌ Erro inesperado',
            description: 'Ocorreu um erro ao executar o comando.',
            color: '#FF0000'
          })]
        });
      }
    }
  }
});

// Configurando eventos do Yukufy
function setupYukufyEvents() {
  // Quando uma música começa a tocar
  yukufy.on('trackStart', ({ track, guildId }) => {
    console.log(`[Yukufy] Reproduzindo: ${track.title} - ${track.artist} (${guildId})`);
    
    const textChannel = track.textChannel;
    if (textChannel) {
      textChannel.send({
        embeds: [createEmbed({
          title: '🎵 Tocando agora',
          description: `**${track.title}**\nArtista: ${track.artist}`,
          color: '#8A2BE2',
          thumbnail: track.thumbnail,
          fields: [
            { name: 'Duração', value: track.duration, inline: true },
            { name: 'Adicionado por', value: `<@${track.member.id}>`, inline: true }
          ]
        })]
      });
    }
  });
  
  // Quando uma música é adicionada à fila
  yukufy.on('trackAdd', ({ track, queue, guildId }) => {
    console.log(`[Yukufy] Música adicionada: ${track.title} - ${track.artist} (${guildId})`);
    
    // Se a música foi adicionada automaticamente, não enviamos notificação
    if (track.autoAdded) return;
    
    const textChannel = track.textChannel;
    if (textChannel && queue.length > 1) {
      textChannel.send({
        embeds: [createEmbed({
          title: '➕ Adicionado à fila',
          description: `**${track.title}**\nArtista: ${track.artist}`,
          color: '#4CAF50',
          thumbnail: track.thumbnail,
          fields: [
            { name: 'Posição', value: `${queue.length}`, inline: true },
            { name: 'Duração', value: track.duration, inline: true },
            { name: 'Adicionado por', value: `<@${track.member.id}>`, inline: true }
          ]
        })]
      });
    }
  });
  
  // Quando a música termina
  yukufy.on('trackEnd', ({ track, guildId }) => {
    console.log(`[Yukufy] Música finalizada: ${track.title} - ${track.artist} (${guildId})`);
  });
  
  // Quando há um erro na reprodução
  yukufy.on('trackError', ({ track, error, guildId }) => {
    console.error(`[Yukufy] Erro na reprodução: ${track.title} - ${error.message} (${guildId})`);
    
    const textChannel = track.textChannel;
    if (textChannel) {
      textChannel.send({
        embeds: [createEmbed({
          title: '❌ Erro na reprodução',
          description: `Não foi possível reproduzir **${track.title}**.\nPulando para a próxima música.`,
          color: '#FF0000'
        })]
      });
    }
  });
  
  // Quando a fila termina
  yukufy.on('queueEnd', ({ guildId }) => {
    console.log(`[Yukufy] Fila finalizada (${guildId})`);
  });
  
  // Quando a fila é limpa
  yukufy.on('queueClear', ({ guildId }) => {
    console.log(`[Yukufy] Fila limpa (${guildId})`);
  });
  
  // Quando há uma desconexão
  yukufy.on('disconnect', ({ guildId, error }) => {
    console.log(`[Yukufy] Desconectado do canal (${guildId})`);
  });
  
  // Quando há um erro no player
  yukufy.on('playerError', ({ error, guildId }) => {
    console.error(`[Yukufy] Erro no player: ${error.message} (${guildId})`);
  });
}

// Inicialização do cliente
client.once('ready', async () => {
  console.log(`Bot conectado como ${client.user.tag}`);
  
  try {
    // Inicializa o Yukufy
    await yukufy.initialize();
    console.log('Yukufy inicializado com sucesso!');
    
    // Configura eventos
    setupYukufyEvents();
    
    // Registra comandos
    await registerCommands();
    
    // Define status de pronto
    isReady = true;
    
    // Define status do bot
    client.user.setActivity('músicas com Yukufy', { type: 'PLAYING' });
  } catch (error) {
    console.error('Erro na inicialização:', error);
  }
});

// Tratamento de erros não capturados
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

// Inicialização do bot
client.login(config.token).catch(console.error);