// Cartas que flotan a los lados de la portada de la galería. Especiales de
// colores variados, alternando cálidas y frías; las tres primeras van a la
// izquierda y las tres últimas a la derecha. En pantallas estrechas solo se
// ven las primeras de cada lado (ver portada.css).
import { catalogo } from './catalog.js'

export const DESTACADAS = ['e-rengoku', 'e-goku', 'e-mitsuri_kanroji', 'e-luffy__gear5', 'e-kakashi', 'e-makima']

/** Las cartas destacadas que existen en el catálogo, en su orden. */
export const cartasDestacadas = (cat = catalogo) => DESTACADAS.map((id) => cat.carta(id)).filter(Boolean)
