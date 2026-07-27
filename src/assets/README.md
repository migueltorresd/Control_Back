# Assets del PDF

`logo-scala.png` — logo de Scala Leather que se imprime en el encabezado del vale
de producción (`ValePdfService`). PNG con fondo transparente, ancho recomendado
~600 px (se escala a 96×40 pt).

Si el archivo no está, el vale se genera igual pero con la marca en texto.
`nest-cli.json` copia esta carpeta a `dist/assets/` en el build.
