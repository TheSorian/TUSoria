export const PROVISIONAL_STOPS = [];

export const SERVICE_ALERTS = [
  {
    id: "aviso1",
    title: "⚠️ Obras en C/ Las Casas - Líneas L2, L4E y EX desviadas",
    date: "En vigor",
    description: "Por motivo de obras en la C/ Las Casas, las paradas habituales se desplazan 120 metros.",
    severity: "warning",
    lines: ["L2", "L4E", "EX"]
  },
  {
    id: "aviso2",
    title: "⚠️ Obras en C/ Dr. Fleming - Líneas L1, L3 y L4 afectadas",
    date: "En vigor",
    description: "Tráfico modificado por obras en Dr. Fleming. Se establece parada provisional cercana en Av. Valladolid.",
    severity: "warning",
    lines: ["L1", "L3", "L4"]
  }
];
