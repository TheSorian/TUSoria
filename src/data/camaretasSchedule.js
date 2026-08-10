export const CAMARETAS_TIMETABLE = {
  lineName: "Servicio de Autobuses Soria ↔ Golmayo / Las Camaretas",
  operator: "Ayuntamiento de Golmayo",
  fare: "0,60 € (Con tarjeta ciudadana)",
  note: "Horarios oficiales del cartel del Ayuntamiento de Golmayo",
  stopsOrder: {
    camaretasToSoria: [
      "Centro Cívico",
      "Parada Centro Comercial",
      "Estación de Autobuses",
      "Avda. Duques de Soria"
    ],
    soriaToCamaretas: [
      "Avda. Duques de Soria",
      "Estación de Autobuses",
      "Parada Centro Comercial",
      "Centro Cívico"
    ]
  },
  departuresFromCamaretas: {
    mondayToThursday: [
      { time: "07:30", arrSoria: "07:45", isNew: true },
      { time: "08:30", arrSoria: "08:45", isNew: true },
      { time: "09:30", arrSoria: "09:45", isNew: true },
      { time: "11:30", arrSoria: "11:45", isNew: true },
      { time: "13:30", arrSoria: "13:45", isNew: false },
      { time: "14:30", arrSoria: "14:45", isNew: false },
      { time: "15:30", arrSoria: "15:45", isNew: false },
      { time: "16:30", arrSoria: "16:45", isNew: false },
      { time: "17:30", arrSoria: "17:45", isNew: false },
      { time: "18:30", arrSoria: "18:45", isNew: false },
      { time: "19:30", arrSoria: "19:45", isNew: false },
      { time: "20:30", arrSoria: "20:45", isNew: false }
    ],
    fridayAndSaturday: [
      { time: "07:30", arrSoria: "07:45", isNew: true },
      { time: "08:30", arrSoria: "08:45", isNew: true },
      { time: "09:30", arrSoria: "09:45", isNew: true },
      { time: "11:30", arrSoria: "11:45", isNew: true },
      { time: "13:30", arrSoria: "13:45", isNew: false },
      { time: "14:30", arrSoria: "14:45", isNew: false },
      { time: "15:30", arrSoria: "15:45", isNew: false },
      { time: "16:30", arrSoria: "16:45", isNew: false },
      { time: "17:30", arrSoria: "17:45", isNew: false },
      { time: "18:30", arrSoria: "18:45", isNew: false },
      { time: "19:30", arrSoria: "19:45", isNew: false },
      { time: "20:30", arrSoria: "20:45", isNew: false },
      { time: "21:30", arrSoria: "21:45", isNew: false },
      { time: "22:30", arrSoria: "22:45", isNew: true },
      { time: "23:30", arrSoria: "23:45", isNew: true },
      { time: "00:30", arrSoria: "00:45", isNew: true }
    ],
    sunday: [
      { time: "20:25", arrSoria: "20:30", isNew: false, note: "Solo salida Parada Centro Comercial" }
    ]
  },
  departuresFromSoria: {
    mondayToThursday: [
      { time: "08:00", arrCamaretas: "08:15", isNew: true },
      { time: "09:00", arrCamaretas: "09:15", isNew: true },
      { time: "10:00", arrCamaretas: "10:15", isNew: true },
      { time: "12:00", arrCamaretas: "12:15", isNew: true },
      { time: "13:00", arrCamaretas: "13:15", isNew: false },
      { time: "14:00", arrCamaretas: "14:15", isNew: false },
      { time: "15:15", arrCamaretas: "15:30", isNew: false },
      { time: "16:00", arrCamaretas: "16:15", isNew: false },
      { time: "17:00", arrCamaretas: "17:15", isNew: false },
      { time: "18:00", arrCamaretas: "18:15", isNew: false },
      { time: "19:00", arrCamaretas: "19:15", isNew: false },
      { time: "20:00", arrCamaretas: "20:15", isNew: false }
    ],
    fridayAndSaturday: [
      { time: "08:00", arrCamaretas: "08:15", isNew: true },
      { time: "09:00", arrCamaretas: "09:15", isNew: true },
      { time: "10:00", arrCamaretas: "10:15", isNew: true },
      { time: "12:00", arrCamaretas: "12:15", isNew: true },
      { time: "13:00", arrCamaretas: "13:15", isNew: false },
      { time: "14:00", arrCamaretas: "14:15", isNew: false },
      { time: "15:15", arrCamaretas: "15:30", isNew: false },
      { time: "16:00", arrCamaretas: "16:15", isNew: false },
      { time: "17:00", arrCamaretas: "17:15", isNew: false },
      { time: "18:00", arrCamaretas: "18:15", isNew: false },
      { time: "19:00", arrCamaretas: "19:15", isNew: false },
      { time: "20:00", arrCamaretas: "20:15", isNew: false },
      { time: "21:00", arrCamaretas: "21:15", isNew: false },
      { time: "22:00", arrCamaretas: "22:15", isNew: true },
      { time: "23:00", arrCamaretas: "23:15", isNew: true },
      { time: "00:00", arrCamaretas: "00:15", isNew: true },
      { time: "01:00", arrCamaretas: "01:15", isNew: true }
    ],
    sunday: [
      { time: "18:00", arrCamaretas: "18:05", isNew: false, note: "Solo salida Estación de Autobuses" }
    ]
  }
};
