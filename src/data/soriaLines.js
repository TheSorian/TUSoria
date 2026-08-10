export const SORIA_LINES = [
  {
    id: "001",
    code: "L1",
    name: "L1: Centro / Pajaritos / Royales / Centro / San Pedro / Hospitales / San Pedro / * Calaverón",
    shortName: "Centro - Hospitales (vía Pajaritos)",
    color: "#103056",
    badgeClass: "badge-l1",
    isRealTimeAvailable: true,
    terminals: ["Mariano Granados", "Hospital Santa Bárbara"],
    frequencies: {
      workday: "Cada 20 min (07:30 a 22:30)",
      saturday: "Cada 30 min (08:30 a 22:00)",
      holiday: "Sin servicio (Ver Línea Circular)"
    }
  },
  {
    id: "002",
    code: "L2",
    name: "L2: Centro / Est Autobuses / Barriada / Tejera / Santa Bárbara / * Polígono",
    shortName: "Centro - Polígono - Est. Autobuses",
    color: "#E31A38",
    badgeClass: "badge-l2",
    isRealTimeAvailable: true,
    terminals: ["El Salvador", "Polígono Industrial"],
    frequencies: {
      workday: "Cada 20 min (07:40 a 22:40)",
      saturday: "Cada 30 min (08:40 a 21:40)",
      holiday: "Sin servicio (Ver Línea Circular)"
    }
  },
  {
    id: "003",
    code: "L3",
    name: "L3: Centro / Royales / Pajaritos / Centro / San Pedro / Hospitales / San Pedro / * Calaverón",
    shortName: "Centro - Hospitales (vía Royales)",
    color: "#00A3E0",
    badgeClass: "badge-l3",
    isRealTimeAvailable: true,
    terminals: ["Mariano Granados", "Hospital Santa Bárbara"],
    frequencies: {
      workday: "Cada 20 min (07:35 a 22:15)",
      saturday: "Cada 30 min (08:45 a 21:45)",
      holiday: "Sin servicio"
    }
  },
  {
    id: "004",
    code: "L4",
    name: "L4: Centro / Hospitales / Est. Autobuses / Centro",
    shortName: "Centro - Hospitales - Estación",
    color: "#059669",
    badgeClass: "badge-l4",
    isRealTimeAvailable: true,
    terminals: ["Mariano Granados", "Estación Autobuses"],
    frequencies: {
      workday: "Cada 30 min (07:45 a 21:45)",
      saturday: "Cada 30 min (09:15 a 21:15)",
      holiday: "Sin servicio"
    }
  },
  {
    id: "012",
    code: "L4E",
    name: "L4E: El Salvador / Polígono / Barrio de Las Casas",
    shortName: "El Salvador - Barrio de Las Casas",
    color: "#059669",
    badgeClass: "badge-l4e",
    isRealTimeAvailable: true,
    terminals: ["El Salvador", "Barrio de Las Casas"],
    frequencies: {
      workday: "Expediciones puntuales (07:50, 13:50, 19:50)",
      saturday: "Expediciones puntuales",
      holiday: "Sin servicio"
    }
  },
  {
    id: "008",
    code: "C",
    name: "C: CIRCULAR - Festivos - El Salvador/Barriada/Tejera/Royales/Plz M Granados/PAjaritos/Calaverón/R y Cajal/San Pedro/Hospitales/Est. Autobuses",
    shortName: "Línea Circular (Festivos)",
    color: "#7B3F8D",
    badgeClass: "badge-c",
    isRealTimeAvailable: true,
    terminals: ["El Salvador", "Hospital Santa Bárbara"],
    frequencies: {
      workday: "Sin servicio (Líneas 1-4 activas)",
      saturday: "Sin servicio",
      holiday: "Cada 30 min (09:00 a 21:30)"
    }
  },
  {
    id: "009",
    code: "EX",
    name: "EX: EXPRES POLÍGONO - Centro / Polígono / San Pedro",
    shortName: "Exprés Polígono Industrial",
    color: "#F39200",
    badgeClass: "badge-ex",
    isRealTimeAvailable: true,
    terminals: ["Mariano Granados", "Polígono Valcorba / Casas"],
    frequencies: {
      workday: "Turnos de entrada laboral (06:45, 07:45, 14:45)",
      saturday: "Sin servicio",
      holiday: "Sin servicio"
    }
  },
  {
    id: "LC_CAMARETAS",
    code: "LC",
    name: "LC: Soria (Duques de Soria / Estación Autobuses) - Golmayo (CC Camaretas / Centro Cívico)",
    shortName: "Soria - Las Camaretas",
    color: "#d4af37",
    badgeClass: "badge-lc",
    isRealTimeAvailable: false,
    terminals: ["Av. Duques de Soria", "Centro Cívico Las Camaretas"],
    frequencies: {
      workday: "Cada 30 min (08:00 a 22:00)",
      saturday: "Cada 30-45 min (09:00 a 22:30)",
      holiday: "Servicio especial tarde (16:00 a 22:00)"
    }
  }
];

import { SORIA_ALL_STOPS as ALL_OFFICIAL_STOPS } from './soriaLinesData';

export const SORIA_ALL_STOPS = ALL_OFFICIAL_STOPS;
export const SORIA_MAIN_STOPS = SORIA_ALL_STOPS;

export const SORIA_KEY_PLACES = [
  { name: "Plaza Mariano Granados", lat: 41.7638, lng: -2.4687, type: "Plaza / Centro" },
  { name: "El Collado / Plaza Mayor", lat: 41.7632, lng: -2.4645, type: "Centro Histórico" },
  { name: "Estación de Autobuses de Soria", lat: 41.7655, lng: -2.4762, type: "Estación" },
  { name: "Hospital Santa Bárbara", lat: 41.7588, lng: -2.4721, type: "Hospital" },
  { name: "Hospital Virgen del Mirón", lat: 41.7698, lng: -2.4612, type: "Hospital" },
  { name: "Campus Universitario Los Pajaritos (UVa)", lat: 41.7554, lng: -2.4695, type: "Universidad" },
  { name: "Centro Comercial Camaretas", lat: 41.7592, lng: -2.5012, type: "Comercio" },
  { name: "Alameda de Cervantes (La Dehesa)", lat: 41.7645, lng: -2.4705, type: "Parque" },
  { name: "Concatedral de San Pedro", lat: 41.7651, lng: -2.4591, type: "Monumento" },
  { name: "Polígono Industrial Las Casas", lat: 41.7765, lng: -2.4795, type: "Industrial" },
  { name: "Barrio de Los Royales", lat: 41.7521, lng: -2.4789, type: "Residencial" },
  { name: "Golmayo Pueblo", lat: 41.7545, lng: -2.5089, type: "Municipio" }
];
