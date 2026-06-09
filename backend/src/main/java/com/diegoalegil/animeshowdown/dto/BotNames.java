package com.diegoalegil.animeshowdown.dto;

import java.util.List;

/**
 * Pool de usernames creíbles para el rival-bot del PvP en directo. Antes el bot
 * se mostraba siempre como "Rival PvP", lo que delataba al instante que no era
 * humano en pantalla. Ahora cada duelo toma un nombre de esta lista
 * de forma DETERMINISTA por id de duelo, así el rival parece un usuario real y
 * el nombre no cambia entre frames del mismo duelo.
 *
 * No son cuentas reales: el bot no tiene fila en {@code usuario}; este nombre
 * vive solo en el DTO de presentación.
 */
public final class BotNames {

    private BotNames() {
    }

    private static final List<String> NAMES = List.of(
            "akira_sensei", "shadowblade88", "miko_chan", "ramenlord", "kenji_runs",
            "otaku_prime", "sasuke_no_kun", "luna_kitsune", "blueexorcist", "tanjiro_fan",
            "marco_dlr", "yuki_onna", "panda_rojo", "elgatonegro", "darkschneider",
            "hikari_92", "zorochopper", "nina_tactics", "redhairshanks", "bocchi_rocks",
            "kaitokid_xx", "frieren_main", "samuraisol", "neonpulse", "akatsuki_dawn",
            "miyuki_sama", "gigachadguts", "leoncito_07", "spiralpower", "kuroko_no",
            "aoba_dev", "senpai_noticed", "vagabond_x", "rei_ayanami0", "diegofut99",
            "thunderclap", "moonlitfox", "sukunafingers", "rookie_andres", "pixel_ronin",
            "haru_winters", "calvo_saitama", "domain_expand", "nezuko_box", "violet_evergard",
            "cloudsama", "rasenganz", "tokyo_drift7", "akame_ga", "lobo_solitario",
            "matchaaddict", "ryukoflash", "berserkmania", "yorforger", "midoriya_plus",
            "ace_of_fire", "kawaii_killer", "shinji_pilot", "gon_freecss", "pablo_otaku",
            "stormbringer", "hinata_jump", "cyberpunk_jin", "alucard_no1", "sailor_yuki",
            "guts_struggle", "naranja_kun", "deku_smash", "ghostofyotei", "minato_flash",
            "katana_zero", "rukia_soul", "elsamurai_es", "fern_magic", "vinland_thor",
            "asuka_langley", "powerblood", "kira_yoshikage", "carlosvg", "winter_soldier",
            "homelander_no", "mob_psycho100", "kakashi_lazy", "tanya_degu", "ironfist_lee",
            "saitamapunch", "yuno_grinta", "darkflame_jin", "marin_kitagawa", "edward_elric",
            "fullcounter", "shoto_half", "okarun_run", "level_grind", "blackclover_x",
            "joseph_jojo", "neon_genesis", "rocklee_drunk", "valeria_es", "endgameguts",
            "kamehameha_z", "tsubasa_wing", "lawliet_eyes", "noragami_yato", "fujimoto_san");

    /**
     * Elige un nombre estable por duelo. {@code dueloId} es invariable durante
     * toda la vida del duelo, así que el rival mantiene el mismo nombre en cada
     * snapshot de estado. Determinista (no usa aleatoriedad → tests reproducibles).
     */
    public static String pick(Long dueloId) {
        long seed = dueloId == null ? 0L : dueloId;
        return NAMES.get((int) Math.floorMod(seed, NAMES.size()));
    }
}
