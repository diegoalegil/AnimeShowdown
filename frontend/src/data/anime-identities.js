const THEMES = {
  amber: { accentRgb: '197 161 90', glowRgb: '138 90 22', atmosphere: 'tribute' },
  blue: { accentRgb: '31 107 131', glowRgb: '36 198 220', atmosphere: 'archive' },
  crimson: { accentRgb: '159 29 44', glowRgb: '197 161 90', atmosphere: 'arena-storm' },
  cyan: { accentRgb: '36 198 220', glowRgb: '75 50 127', atmosphere: 'ritual' },
  emerald: { accentRgb: '63 93 63', glowRgb: '197 161 90', atmosphere: 'forest' },
  gold: { accentRgb: '138 90 22', glowRgb: '197 161 90', atmosphere: 'arena' },
  rose: { accentRgb: '159 29 44', glowRgb: '75 50 127', atmosphere: 'ritual' },
  shadow: { accentRgb: '17 24 39', glowRgb: '159 29 44', atmosphere: 'archive' },
  steel: { accentRgb: '31 107 131', glowRgb: '159 29 44', atmosphere: 'arena-storm' },
  violet: { accentRgb: '75 50 127', glowRgb: '36 198 220', atmosphere: 'arcane' },
}

const AUDIO_CUES = {
  anthem: 'fanfarrea breve con golpe de estadio',
  arcane: 'campana cristalina sobre pulso bajo',
  battle: 'taiko seco con impacto de metal',
  chase: 'hi-hat rapido y golpe cinematografico',
  comedy: 'marimba corta con cierre brillante',
  court: 'clack de tablero y cuerda tensa',
  dream: 'pad suave con destello de campana',
  horror: 'subgrave lento con rasgueo distante',
  mecha: 'servo grave y golpe de aleacion',
  mystery: 'tic tac filtrado y nota suspendida',
  romance: 'piano corto con aire de cuerda',
  school: 'campana escolar y pulso ligero',
  sport: 'silbato corto con percusion de grada',
  voyage: 'viento amplio y campana lejana',
}

const ASSET_SLUGS = {
  'alya-sometimes-hides-her-feelings-in-russian': 'roshidere',
  'bunny-girl-senpai': 'seishun-buta-yarou-bunny-girl-senpai',
  'chuunibyou-demo-koi-ga-shitai': 'chuunibyou',
  'frieren-beyond-journey-s-end': 'frieren',
  'kaguya-sama-love-is-war': 'love-is-war',
  'mazinger-z': 'mazinger',
  'spy-family': 'spy-x-family',
  'the-angel-next-door-spoils-me-rotten': 'the-angel-next-door',
}

const ROWS = [
  ['86-eighty-six', '86 Eighty-Six', '無', 'escuadron no reconocido', ['mecha militar', 'frontera de niebla', 'senal tactica'], 'Drama belico de frontera con acero frio, mando remoto y memoria de escuadron.', 'signal-grid', 'steel', 'mecha'],
  ['akame-ga-kill', 'Akame ga Kill!', '刃', 'night raid', ['hojas carmesi', 'imperio corrupto', 'sombras de asesinato'], 'Rebelion oscura con filo rojo, contratos imposibles y golpes de justicia brutal.', 'assassin-mark', 'crimson', 'battle'],
  ['alya-sometimes-hides-her-feelings-in-russian', 'Alya Sometimes Hides Her Feelings in Russian', '露', 'susurro bilingue', ['nieve suave', 'consejo estudiantil', 'mirada reservada'], 'Romance escolar de invierno con frases veladas, orgullo elegante y complicidad lenta.', 'snow-script', 'blue', 'school'],
  ['angel-beats', 'Angel Beats!', '奏', 'afterlife band', ['campus liminal', 'teclado brillante', 'alas rotas'], 'Juventud suspendida entre conciertos, despedidas y una guerra luminosa contra el olvido.', 'afterlife-score', 'cyan', 'dream'],
  ['another', 'Another', '禍', 'aula maldita', ['paraguas rojo', 'aula vacia', 'presagio de lluvia'], 'Misterio escolar con silencio pesado, clase marcada y una amenaza que nadie quiere nombrar.', 'cursed-class', 'shadow', 'horror'],
  ['ao-no-exorcist', 'Ao no Exorcist', '祓', 'llama azul', ['exorcistas', 'academia oculta', 'fuego azul'], 'Accion sobrenatural de academia secreta con llamas azules, linaje prohibido y rituales de combate.', 'blue-flame-seal', 'blue', 'arcane'],
  ['aoashi', 'Aoashi', '蹴', 'vision de campo', ['cesped nocturno', 'lineas tacticas', 'botas veloces'], 'Futbol de formacion con lectura de espacios, hambre competitiva y energia de cantera.', 'pitch-map', 'emerald', 'sport'],
  ['assassination-classroom', 'Assassination Classroom', '暗', 'aula objetivo', ['aula 3-E', 'diana amarilla', 'tiza y entrenamiento'], 'Comedia de clase imposible con entrenamiento tactico, afecto raro y una cuenta atras enorme.', 'target-board', 'gold', 'comedy'],
  ['attack-on-titan', 'Attack on Titan', '壁', 'muralla partida', ['murallas', 'humo de batalla', 'libertad amarga'], 'Guerra desesperada tras muros gigantes, humo, acero y una pregunta feroz por la libertad.', 'wall-scar', 'gold', 'battle'],
  ['beyblade', 'Beyblade', '旋', 'peonza de torneo', ['arena circular', 'chispas metalicas', 'racha de giro'], 'Competicion de peonzas con duelos explosivos, energia de estadio y orgullo de equipo.', 'spin-ring', 'steel', 'anthem'],
  ['black-clover', 'Black Clover', '魔', 'grimorio trebol', ['grimorios', 'torres magicas', 'escuadron rebelde'], 'Fantasia de escuadrones magicos con voluntad testaruda, rivalidad y hechizos de alto impacto.', 'grimoire-leaf', 'emerald', 'arcane'],
  ['black-lagoon', 'Black Lagoon', '銃', 'laguna criminal', ['neon portuario', 'pistolas gemelas', 'humo de bar'], 'Crimen de puerto nocturno con mercenarios, dialogo afilado y moral en zona gris.', 'harbor-neon', 'shadow', 'chase'],
  ['bleach', 'Bleach', '魂', 'shinigami badge', ['zanpakuto', 'reishi azul', 'puertas espirituales'], 'Batallas espirituales con espadas con nombre, mundos paralelos y presion de reiatsu.', 'soul-gate', 'blue', 'battle'],
  ['blue-lock', 'Blue Lock', '闘', 'ego striker', ['jaula de futbol', 'ojo de ego', 'red de porteria'], 'Futbol de ego puro con delanteros en jaula, decisiones rapidas y hambre de gol.', 'ego-net', 'cyan', 'sport'],
  ['bocchi-the-rock', 'Bocchi the Rock!', '弦', 'banda de ensayo', ['guitarra rosa', 'sala live', 'ansiedad luminosa'], 'Comedia musical de escenario pequeno, riffs sinceros y panico social convertido en energia.', 'amp-wave', 'rose', 'comedy'],
  ['btooom', 'Btooom!', '爆', 'isla bomba', ['isla hostil', 'radar de pulsera', 'explosivos'], 'Supervivencia de isla con bombas, paranoia competitiva y decisiones bajo cuenta atras.', 'blast-radar', 'crimson', 'chase'],
  ['bunny-girl-senpai', 'Bunny Girl Senpai', '青', 'sindrome adolescente', ['biblioteca', 'mar al atardecer', 'paradoja emocional'], 'Romance melancolico con fenomenos raros, adolescencia invisible y conversaciones precisas.', 'adolescence-ripple', 'blue', 'romance'],
  ['chainsaw-man', 'Chainsaw Man', '鋸', 'cordon de motosierra', ['sierra carmesi', 'contratos demonio', 'calle sucia'], 'Accion salvaje de demonios y deudas, metal brutal y ternura torpe bajo luces urbanas.', 'saw-chain', 'crimson', 'battle'],
  ['charlotte', 'Charlotte', '星', 'orbita adolescente', ['aula nocturna', 'estrellas fugaces', 'poder imperfecto'], 'Drama de poderes adolescentes con coste emocional, memoria y decisiones de alto precio.', 'star-fracture', 'blue', 'dream'],
  ['chuunibyou-demo-koi-ga-shitai', 'Chuunibyou demo Koi ga Shitai!', '幻', 'ojo del pacto', ['fantasia escolar', 'vendaje dramatico', 'aula soleada'], 'Romance escolar donde la imaginacion exagerada se vuelve refugio, juego y lenguaje propio.', 'delusion-eye', 'violet', 'comedy'],
  ['claymore', 'Claymore', '銀', 'espada plateada', ['bosque frio', 'ojos plateados', 'sello yoma'], 'Fantasia oscura de cazadoras marcadas, metal frio y monstruos al borde de la identidad.', 'silver-sigil', 'steel', 'battle'],
  ['code-geass', 'Code Geass', '命', 'geass real', ['tablero imperial', 'ojo rojo', 'mecha tactico'], 'Estrategia imperial con mascaras, rebelion calculada y una orden que cambia destinos.', 'imperial-board', 'violet', 'court'],
  ['cowboy-bebop', 'Cowboy Bebop', '宙', 'jazz de orbita', ['jazz noir', 'naves gastadas', 'neon de cazarrecompensas'], 'Noir espacial con swing seco, persecuciones cansadas y melancolia de tripulacion.', 'bebop-bars', 'blue', 'voyage'],
  ['cyberpunk-edgerunners', 'Cyberpunk Edgerunners', '義', 'neon chrome', ['neon saturado', 'cromo callejero', 'pulso de implante'], 'Tragedia cyberpunk de calle con implantes, exceso de velocidad y brillo peligroso.', 'chrome-noise', 'cyan', 'chase'],
  ['dandadan', 'Dandadan', '怪', 'onda paranormal', ['ovnis', 'fantasmas urbanos', 'energia absurda'], 'Paranormal hiperactivo con humor, persecuciones imposibles y choques entre ocultismo y sci-fi.', 'ufo-spiral', 'rose', 'comedy'],
  ['darling-in-the-franxx', 'Darling in the Franxx', '翼', 'pareja piloto', ['cabina sincronizada', 'flor roja', 'mecha organico'], 'Mecha romantico con sincronizacion emocional, juventud encerrada y deseo de cielo abierto.', 'sync-wing', 'rose', 'mecha'],
  ['date-a-live', 'Date A Live', '約', 'cita espiritual', ['reloj celestial', 'cita decisiva', 'aura espiritual'], 'Comedia romantica de alto riesgo donde una cita puede desactivar una catastrofe.', 'spirit-clock', 'violet', 'romance'],
  ['death-note', 'Death Note', '裁', 'libreta negra', ['libreta', 'manzana roja', 'luz de juicio'], 'Thriller de juicio moral con libreta negra, inteligencia fria y una guerra de nombres.', 'name-ledger', 'shadow', 'mystery'],
  ['demon-slayer', 'Demon Slayer', '滅', 'luna nichirin', ['respiracion', 'luna neblinosa', 'haori geometrico'], 'Caza demonios de epoca con respiraciones, duelo familiar y belleza fatal bajo la luna.', 'nichirin-moon', 'crimson', 'battle'],
  ['dr-stone', 'Dr. Stone', '科', 'reino cientifico', ['piedra agrietada', 'laboratorio primitivo', 'chispa cyan'], 'Aventura cientifica postapocaliptica con ingenio, experimentos y reconstruccion desde cero.', 'science-crack', 'gold', 'arcane'],
  ['dragon-ball', 'Dragon Ball', '龍', 'esfera del dragon', ['aura dorada', 'nube veloz', 'torneo mundial'], 'Aventura marcial de energia enorme, rivalidades legendarias y deseo concedido por esferas.', 'dragon-orb', 'gold', 'battle'],
  ['elfen-lied', 'Elfen Lied', '痛', 'vector invisible', ['silueta rota', 'coros frios', 'sangre abstracta'], 'Drama tragico de aislamiento y violencia invisible, con belleza inquietante y heridas abiertas.', 'vector-halo', 'rose', 'horror'],
  ['erased', 'Erased', '戻', 'revival nevado', ['nieve de Hokkaido', 'reloj roto', 'bufanda roja'], 'Misterio emocional de regresos temporales, infancia marcada y una carrera contra el invierno.', 'revival-clock', 'blue', 'mystery'],
  ['fairy-tail', 'Fairy Tail', '絆', 'marca de gremio', ['gremio magico', 'fuego amistoso', 'emblema de equipo'], 'Fantasia de gremio con amistad ruidosa, magia elemental y celebracion tras cada pelea.', 'guild-mark', 'crimson', 'anthem'],
  ['fate-grand-order', 'Fate/Grand Order', '冠', 'caldea singularity', ['mesa de invocacion', 'anillos temporales', 'reliquias heroicas'], 'Viaje por singularidades con heroes invocados, historia fracturada y estrategia ceremonial.', 'summon-rings', 'violet', 'arcane'],
  ['fate-stay-night', 'Fate/Stay Night', '聖', 'grial de duelo', ['grial', 'sable dorado', 'calle nocturna'], 'Guerra ritual de magos y heroes, promesas antiguas y duelos iluminados por mana.', 'grail-seal', 'gold', 'court'],
  ['fate-zero', 'Fate/Zero', '零', 'grial oscuro', ['ciudad lluviosa', 'contratos de servant', 'cero moral'], 'Preludio cruel de la guerra del grial con estrategia fria y sacrificios sin salida facil.', 'zero-grail', 'shadow', 'court'],
  ['fire-force', 'Fire Force', '炎', 'brigada infernal', ['llamas negras', 'campana de alarma', 'huella ardiente'], 'Accion de brigada pirocinetica con fuego santo, misterio religioso y velocidad explosiva.', 'infernal-bell', 'crimson', 'battle'],
  ['frieren-beyond-journey-s-end', "Frieren: Beyond Journey's End", '旅', 'memoria de viaje', ['pradera antigua', 'grimorio tranquilo', 'aurora magica'], 'Fantasia contemplativa sobre tiempo, despedidas y magia aprendida a paso lento.', 'journey-aurora', 'emerald', 'voyage'],
  ['fullmetal-alchemist', 'Fullmetal Alchemist', '錬', 'circulo alquimico', ['circulo de transmutacion', 'metal dorado', 'intercambio equivalente'], 'Aventura alquimica con ciencia prohibida, hermandad y chispas doradas de verdad incomoda.', 'alchemy-circle', 'gold', 'arcane'],
  ['fumetsu-no-anata-e', 'Fumetsu no Anata e', '永', 'eco inmortal', ['esfera blanca', 'huellas en nieve', 'formas cambiantes'], 'Viaje inmortal de perdida y aprendizaje, cada forma como una memoria que pesa.', 'immortal-orbit', 'blue', 'dream'],
  ['gachiakuta', 'Gachiakuta', '塵', 'reliquia de basura', ['graffiti industrial', 'chatarra sagrada', 'foso urbano'], 'Fantasia urbana de residuos y rabia, donde los objetos olvidados cargan poder propio.', 'trash-relic', 'steel', 'chase'],
  ['gintama', 'Gintama', '銀', 'yorozuya neon', ['edo absurdo', 'parodia samurai', 'cartel de tienda'], 'Comedia samurai sci-fi con caos verbal, corazon inesperado y reglas listas para romperse.', 'yorozuya-sign', 'cyan', 'comedy'],
  ['gurren-lagann', 'Gurren Lagann', '螺', 'taladro espiral', ['espiral cosmica', 'taladro dorado', 'cielo imposible'], 'Mecha de voluntad gigantesca, energia espiral y ambicion que perfora cualquier techo.', 'spiral-drill', 'crimson', 'mecha'],
  ['haikyuu', 'Haikyuu', '翔', 'salto de cancha', ['red de voleibol', 'salto naranja', 'grada encendida'], 'Voleibol de ritmo rapido con saltos imposibles, lectura de equipo y hambre de punto.', 'volley-flight', 'gold', 'sport'],
  ['hellsing', 'Hellsing', '血', 'sello vampiro', ['niebla gotica', 'sello rojo', 'pistola ceremonial'], 'Caceria gotica con vampiros, instituciones secretas y una elegancia brutal bajo niebla.', 'blood-seal', 'shadow', 'horror'],
  ['high-school-dxd', 'High School DxD', '悪', 'pacto demoniaco', ['circulo rojo', 'club ocultista', 'alas demoniacas'], 'Comedia sobrenatural de escuela y pactos, con clanes demoniacos y energia descarada.', 'devil-circle', 'crimson', 'comedy'],
  ['himouto-umaru-chan', 'Himouto! Umaru-chan', '干', 'modo manta', ['manta naranja', 'snacks', 'habitacion gamer'], 'Comedia domestica de doble vida, snacks, juegos y caos adorable tras la puerta.', 'snack-room', 'gold', 'comedy'],
  ['hunter-x-hunter', 'Hunter x Hunter', '猟', 'licencia hunter', ['nen verde', 'licencia pulida', 'mapa de aventura'], 'Aventura estrategica con Nen, examenes peligrosos y amistades probadas por reglas duras.', 'hunter-license', 'emerald', 'battle'],
  ['hyouka', 'Hyouka', '氷', 'misterio cotidiano', ['club de literatura', 'luz de ventana', 'cristal de hielo'], 'Misterio cotidiano de instituto con observacion fina, calma brillante y curiosidad persistente.', 'ice-window', 'blue', 'mystery'],
  ['inazuma-eleven', 'Inazuma Eleven', '雷', 'rayo de once', ['balon electrico', 'porterias luminosas', 'tormenta de equipo'], 'Futbol supertecnico con energia de rayo, amistad de equipo y tiros especiales.', 'thunder-ball', 'cyan', 'sport'],
  ['inuyasha', 'Inuyasha', '妖', 'pozo feudal', ['era feudal', 'perlas fragmentadas', 'luna roja'], 'Aventura feudal de demonios, viajes por el pozo y fragmentos que atan destinos.', 'feudal-shard', 'crimson', 'voyage'],
  ['jujutsu-kaisen', 'Jujutsu Kaisen', '呪', 'sello maldito', ['talismenes', 'energia maldita', 'ciudad nocturna'], 'Combate urbano de maldiciones, tecnicas heredadas y una amenaza sellada muy cerca.', 'curse-seal', 'violet', 'battle'],
  ['kaguya-sama-love-is-war', 'Kaguya-sama: Love is War', '愛', 'duelo romantico', ['consejo estudiantil', 'tablero mental', 'corazones tacticos'], 'Romance de guerra psicologica con orgullo noble, trampas pequenas y victoria sentimental.', 'love-board', 'rose', 'court'],
  ['kakegurui', 'Kakegurui', '賭', 'mesa de apuesta', ['cartas rojas', 'fichas doradas', 'mirada de riesgo'], 'Juego psicologico de apuestas extremas, placer del riesgo y jerarquias listas para caer.', 'gamble-table', 'crimson', 'court'],
  ['kaoru-hana-wa-rin-to-saku', 'Kaoru Hana wa Rin to Saku', '薫', 'flor cercana', ['flores suaves', 'dos escuelas', 'ventana de tarde'], 'Romance de contrastes escolares con ternura contenida, prejuicios que se aflojan y calma floral.', 'flower-window', 'emerald', 'romance'],
  ['kill-la-kill', 'Kill la Kill', '裁', 'uniforme rebelde', ['tijera roja', 'fibra viva', 'escuela fortaleza'], 'Accion hiperestilizada de uniformes, rebeldia y energia teatral al limite.', 'scissor-fiber', 'crimson', 'battle'],
  ['kimi-no-suizou-wo-tabetai', 'Kimi no Suizou wo Tabetai', '桜', 'diario compartido', ['flores de cerezo', 'diario secreto', 'luz de hospital'], 'Drama intimista de tiempo limitado, diario compartido y una ternura que deja marca.', 'sakura-diary', 'rose', 'romance'],
  ['kobayashi-san-chi-no-maidragon', 'Kobayashi san Chi no Maidragon', '竜', 'dragon domestico', ['cola de dragon', 'apartamento calido', 'magia cotidiana'], 'Comedia domestica de dragones, hogar encontrado y caos magico servido con cariño.', 'dragon-apartment', 'emerald', 'comedy'],
  ['koe-no-katachi', 'Koe no Katachi', '声', 'onda de silencio', ['agua tranquila', 'cuaderno de notas', 'gestos de mano'], 'Drama de reparacion y escucha, con silencio expresivo, culpa y pasos pequenos hacia el otro.', 'silent-wave', 'blue', 'romance'],
  ['komi-san-wa-komyushou-desu', 'Komi san wa Komyushou Desu', '話', 'lista de amigos', ['pizarra limpia', 'gato azul', 'nota timida'], 'Comedia escolar de comunicacion dificil, gestos minimos y una meta enorme de amistad.', 'friend-list', 'blue', 'school'],
  ['konosuba', 'KonoSuba', '爆', 'party caotica', ['explosion magenta', 'misiones absurdas', 'taberna de gremio'], 'Isekai comico de party desastrosa, magia exagerada y mala suerte muy bien acompanada.', 'explosion-party', 'rose', 'comedy'],
  ['log-horizon', 'Log Horizon', '策', 'mesa de raid', ['interfaz MMO', 'mapa de ciudad', 'estrategia de gremio'], 'Isekai estrategico de MMO con politica de gremios, raids y construccion de comunidad.', 'raid-map', 'blue', 'court'],
  ['made-in-abyss', 'Made in Abyss', '深', 'borde del abismo', ['capas del abismo', 'reliquias antiguas', 'luz peligrosa'], 'Exploracion del abismo con maravilla, peligro creciente y reliquias que parecen respirar.', 'abyss-rings', 'emerald', 'voyage'],
  ['madoka-magica', 'Madoka Magica', '魔', 'gema del alma', ['laberinto de bruja', 'gema brillante', 'cintas rosas'], 'Magia tragica de deseo y precio, con laberintos imposibles y dulzura a punto de quebrarse.', 'soul-gem', 'rose', 'arcane'],
  ['mazinger-z', 'Mazinger Z', '機', 'super robot z', ['hangar clasico', 'rayo metalico', 'placa roja'], 'Super robot clasico con presencia de acero, ataques nombrados y heroismo frontal.', 'robot-plate', 'steel', 'mecha'],
  ['mirai-nikki', 'Mirai Nikki', '予', 'diario futuro', ['telefono rojo', 'reloj roto', 'vigilancia obsesiva'], 'Survival game de predicciones, obsesion y decisiones marcadas por un futuro cambiante.', 'future-diary', 'crimson', 'mystery'],
  ['mob-psycho-100', 'Mob Psycho 100', '念', 'contador psiquico', ['aura multicolor', 'contador al cien', 'espiritus urbanos'], 'Comedia psiquica de emociones contenidas, explosiones visuales y crecimiento muy humano.', 'psychic-meter', 'cyan', 'comedy'],
  ['monogatari-series', 'Monogatari Series', '怪', 'texto aberrante', ['carteles tipograficos', 'escalera roja', 'apariciones'], 'Misterio dialogado de apariciones, juegos de lenguaje y heridas convertidas en forma.', 'oddity-text', 'violet', 'mystery'],
  ['monster', 'Monster', '影', 'expediente oscuro', ['hospital frio', 'archivo policial', 'cuento siniestro'], 'Thriller psicologico europeo con culpa, persecucion y una sombra humana demasiado serena.', 'case-file', 'shadow', 'mystery'],
  ['mushishi', 'Mushishi', '蟲', 'sendero mushi', ['bosque brumoso', 'luz organica', 'viajero solitario'], 'Relatos contemplativos de naturaleza extrana, silencio curativo y fenomenos que no son monstruos.', 'mushi-path', 'emerald', 'dream'],
  ['mushoku-tensei', 'Mushoku Tensei', '転', 'segunda vida', ['grimorio viajero', 'cielo de fantasia', 'huellas nuevas'], 'Fantasia de reencarnacion con viaje largo, magia aprendida y crecimiento lleno de fricciones.', 'rebirth-road', 'gold', 'voyage'],
  ['my-dress-up-darling', 'My Dress-Up Darling', '装', 'atelier cosplay', ['telas de cosplay', 'flash de estudio', 'costura fina'], 'Romance creativo de cosplay, vulnerabilidad alegre y taller lleno de detalles.', 'cosplay-atelier', 'rose', 'romance'],
  ['my-hero-academia', 'My Hero Academia', '英', 'academia heroica', ['ciudad heroica', 'quirk energy', 'emblema escolar'], 'Superheroes en formacion con escuela competitiva, villania al acecho y deseo de salvar.', 'hero-academy', 'blue', 'anthem'],
  ['naruto', 'Naruto', '忍', 'aldea shinobi', ['pergamino', 'chakra', 'hoja oculta'], 'Aventura shinobi de perseverancia, lazos de aldea y energia de chakra en movimiento.', 'shinobi-scroll', 'gold', 'battle'],
  ['neon-genesis-evangelion', 'Neon Genesis Evangelion', '使', 'campo at', ['eva purpura', 'geometria angelical', 'ciudad hundida'], 'Mecha psicologico de angeles, aislamiento y geometria ritual alrededor del trauma.', 'at-field', 'violet', 'mecha'],
  ['nisekoi', 'Nisekoi', '鍵', 'promesa con llave', ['candado dorado', 'aula romantica', 'rivalidad torpe'], 'Comedia romantica de promesas, llaves perdidas y alianzas falsas con sentimientos reales.', 'lock-promise', 'gold', 'romance'],
  ['no-game-no-life', 'No Game No Life', '盤', 'tablero blanco', ['tablero neon', 'coronas de juego', 'colores imposibles'], 'Fantasia de juegos donde todo se decide por reglas, bluff y calculo teatral.', 'game-board', 'violet', 'court'],
  ['one-piece', 'One Piece', '海', 'jolly roger dorado', ['mar abierto', 'brujula antigua', 'bandera pirata'], 'Aventura maritima de tripulacion, islas imposibles y libertad con sabor a leyenda.', 'pirate-compass', 'gold', 'voyage'],
  ['one-punch-man', 'One Punch Man', '拳', 'golpe unico', ['ciudad de heroes', 'impacto circular', 'capa al viento'], 'Satira de superheroes con fuerza absurda, rutina seca y monstruos que duran poco.', 'single-impact', 'gold', 'battle'],
  ['oreimo', 'Oreimo', '妹', 'secreto otaku', ['habitacion pop', 'portatil rosa', 'doble vida familiar'], 'Comedia familiar de secreto otaku, orgullo adolescente y conversaciones incomodas pero sinceras.', 'otaku-room', 'rose', 'comedy'],
  ['oshi-no-ko', 'Oshi no Ko', '星', 'estrella de idol', ['escenario idol', 'ojos estrella', 'camara de backstage'], 'Drama de fama y backstage, brillo idol y una investigacion bajo los focos.', 'idol-star', 'rose', 'mystery'],
  ['overlord', 'Overlord', '王', 'trono de nazarick', ['trono obsidiana', 'orbes magicos', 'estandarte oscuro'], 'Fantasia de poder absoluto con estrategia de reino, lealtades monstruosas y solemnidad oscura.', 'obsidian-throne', 'shadow', 'court'],
  ['parasyte', 'Parasyte', '寄', 'mano mutante', ['organismo cambiante', 'suburbio frio', 'lineas biologicas'], 'Body horror existencial con amenaza parasitaria, identidad compartida y supervivencia inquieta.', 'parasite-vein', 'emerald', 'horror'],
  ['pokemon', 'Pokémon', '球', 'pokeball de ruta', ['ruta de aventura', 'esfera roja', 'destello de captura'], 'Aventura de companeros y gimnasios, descubrimiento constante y combate amistoso.', 'capture-orb', 'gold', 'anthem'],
  ['prison-school', 'Prison School', '檻', 'academia jaula', ['rejas escolares', 'sello disciplinario', 'humor extremo'], 'Comedia escolar de castigo y absurdo, tension exagerada y energia de fuga imposible.', 'school-bars', 'shadow', 'comedy'],
  ['re-zero', 'Re:Zero', '死', 'retorno cero', ['reloj congelado', 'mansion nevada', 'miasma violeta'], 'Isekai de bucles dolorosos, decisiones repetidas y esperanza ganada a fuerza de trauma.', 'return-clock', 'violet', 'mystery'],
  ['sakurasou-no-pet-na-kanojo', 'Sakurasou no Pet na Kanojo', '寮', 'residencia sakura', ['dormitorio creativo', 'cerezos', 'lienzo en blanco'], 'Drama escolar creativo sobre talento, convivencia caotica y aprender a no rendirse.', 'sakura-dorm', 'rose', 'school'],
  ['serial-experiments-lain', 'Serial Experiments Lain', '線', 'wired signal', ['cables', 'pantalla CRT', 'ruido digital'], 'Cybermisterio introspectivo de identidad, red y silencio electrico que se cuela en casa.', 'wired-noise', 'shadow', 'mystery'],
  ['solo-leveling', 'Solo Leveling', '影', 'monarca de sombras', ['portal azul', 'sombra ascendente', 'rango de cazador'], 'Power fantasy de mazmorras con ascenso solitario, ejercito de sombras y ranking implacable.', 'shadow-gate', 'violet', 'battle'],
  ['soul-eater', 'Soul Eater', '魂', 'luna guadana', ['luna risuena', 'guadana plateada', 'academia gotica'], 'Accion gotica de almas y armas vivas, humor angular y ritmo de Halloween permanente.', 'scythe-moon', 'violet', 'battle'],
  ['spy-family', 'Spy × Family', '家', 'familia secreta', ['familia falsa', 'telepatia rosa', 'espia elegante'], 'Comedia de espionaje domestico con telepatia, misiones encubiertas y ternura de fachada.', 'family-cipher', 'rose', 'comedy'],
  ['steins-gate', 'Steins Gate', '時', 'linea del mundo', ['reloj divergente', 'microondas experimental', 'akihabara teal'], 'Sci-fi de lineas temporales con conspiracion, laboratorio improvisado y cada mensaje pesando demasiado.', 'world-line', 'blue', 'mystery'],
  ['sword-art-online', 'Sword Art Online', '剣', 'castillo flotante', ['HUD cyan', 'doble espada', 'aincrad'], 'Aventura virtual de espadas, pisos imposibles y vinculos nacidos dentro del sistema.', 'aincrad-hud', 'cyan', 'battle'],
  ['the-angel-next-door-spoils-me-rotten', 'The Angel Next Door Spoils Me Rotten', '天', 'vecina angel', ['apartamento calido', 'paraguas compartido', 'luz de primavera'], 'Romance domestico suave de cuidado diario, gestos pequenos y confianza que crece sin ruido.', 'angel-window', 'amber', 'romance'],
  ['the-promised-neverland', 'The Promised Neverland', '約', 'granja escape', ['valla blanca', 'numero de cuello', 'mapa secreto'], 'Thriller de escape infantil con inteligencia tactica, hogar falso y urgencia de libertad.', 'escape-map', 'shadow', 'mystery'],
  ['tokyo-ghoul', 'Tokyo Ghoul', '喰', 'mascara ghoul', ['mascara rota', 'kagune carmesi', 'lluvia urbana'], 'Horror urbano de identidad partida, hambre peligrosa y una ciudad que no perdona.', 'ghoul-mask', 'crimson', 'horror'],
  ['toradora', 'Toradora!', '虎', 'tigre palmario', ['aula calida', 'tigre pequeno', 'carta romantica'], 'Romance escolar de caracter fuerte, pactos torpes y sentimientos que aparecen por accidente.', 'tiny-tiger', 'gold', 'romance'],
  ['tower-of-god', 'Tower of God', '塔', 'prueba de torre', ['torre infinita', 'agua shinsu', 'puertas de prueba'], 'Fantasia de ascenso con pruebas, alianzas cambiantes y ambicion vertical.', 'tower-trial', 'blue', 'court'],
  ['uma-musume', 'Uma Musume', '駿', 'pista estrella', ['pista de carrera', 'idol deportivo', 'meta brillante'], 'Competicion de carreras con energia idol, entrenamiento duro y finales de foto finish.', 'race-track', 'emerald', 'sport'],
  ['vinland-saga', 'Vinland Saga', '北', 'brujula nordica', ['mar nordico', 'hacha gastada', 'tierra prometida'], 'Saga historica de venganza, mar frio y una busqueda lenta de tierra sin guerra.', 'nordic-compass', 'steel', 'voyage'],
  ['violet-evergarden', 'Violet Evergarden', '愛', 'carta mecanica', ['maquina de escribir', 'flores violetas', 'guantes metalicos'], 'Drama epistolar de memoria y amor, cartas escritas con precision y dolor elegante.', 'letter-type', 'amber', 'romance'],
  ['vocaloid', 'Vocaloid', '音', 'sintetizador vocal', ['ondas neon', 'microfono digital', 'escenario virtual'], 'Escenario musical digital con voces sinteticas, luz cyan y energia de concierto virtual.', 'vocal-wave', 'cyan', 'anthem'],
  ['your-lie-in-april', 'Your Lie in April', '音', 'partitura de abril', ['piano', 'petalos amarillos', 'partitura rota'], 'Drama musical de primavera, duelo interior y notas que devuelven color al mundo.', 'april-score', 'amber', 'romance'],
  ['your-name', 'Your Name', '結', 'hilo de cometa', ['cometa rojo', 'hilo trenzado', 'cielo crepuscular'], 'Romance de cuerpos cruzados, distancia cosmica y un hilo que insiste en unir nombres.', 'comet-thread', 'rose', 'dream'],
]

function makeIdentity([
  slug,
  title,
  kanji,
  emblem,
  motifs,
  copy,
  pattern,
  themeName,
  audioCue,
]) {
  const theme = THEMES[themeName] ?? THEMES.gold
  const assetSlug = ASSET_SLUGS[slug] ?? slug
  return Object.freeze({
    slug,
    title,
    kanji,
    sideKanji: kanji,
    emblem,
    motifs,
    copy,
    pattern,
    audioCue: AUDIO_CUES[audioCue] ?? AUDIO_CUES.anthem,
    assetSlug,
    imageSlot: `/assets/anime-banners/${assetSlug}.webp`,
    accentRgb: theme.accentRgb,
    glowRgb: theme.glowRgb,
    atmosphere: theme.atmosphere,
    theme: themeName,
    isFallback: false,
  })
}

export const ANIME_IDENTITY_DEFINITIONS = Object.freeze(ROWS.map(makeIdentity))

export const ANIME_IDENTITY_BY_SLUG = Object.freeze(
  Object.fromEntries(
    ANIME_IDENTITY_DEFINITIONS.map((identity) => [identity.slug, identity]),
  ),
)

export const GENERIC_ANIME_IDENTITY = Object.freeze({
  slug: '',
  title: 'Universo anime',
  kanji: '界',
  sideKanji: '界',
  emblem: 'fallback generico bloqueado',
  motifs: ['contrato pendiente', 'slot editorial'],
  copy: 'Identidad visual pendiente de curacion.',
  pattern: 'generic-fallback',
  audioCue: 'sin audio dedicado',
  assetSlug: '',
  imageSlot: null,
  accentRgb: THEMES.gold.accentRgb,
  glowRgb: THEMES.gold.glowRgb,
  atmosphere: THEMES.gold.atmosphere,
  theme: 'gold',
  isFallback: true,
})

function titleFromSlug(slug) {
  return String(slug || '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function hasCuratedAnimeIdentity(slug) {
  return Boolean(ANIME_IDENTITY_BY_SLUG[slug])
}

export function getAnimeIdentity(slug, title = slug) {
  const normalizedSlug = String(slug || '')
  const identity = ANIME_IDENTITY_BY_SLUG[normalizedSlug]
  if (identity) {
    return title && title !== identity.title ? { ...identity, title } : identity
  }
  return {
    ...GENERIC_ANIME_IDENTITY,
    slug: normalizedSlug,
    title: title || titleFromSlug(normalizedSlug) || GENERIC_ANIME_IDENTITY.title,
  }
}

export function getAnimeIdentityCoverage(slugs) {
  const missing = slugs.filter((slug) => !hasCuratedAnimeIdentity(slug))
  return {
    total: slugs.length,
    covered: slugs.length - missing.length,
    missing,
  }
}
