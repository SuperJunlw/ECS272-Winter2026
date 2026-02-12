
import React from 'react'
import { useState } from 'react'
import StreamGraphView from './components/StreamGraphView'
import BarView from './components/BarView'
import LineChartView from './components/LineChartView'

import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import Box from '@mui/material/Box'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { grey } from '@mui/material/colors'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'

const theme = createTheme({
  palette: {
    primary: { main: grey[700] },
    secondary: { main: grey[700] }
  }
})

function Layout() {
  const [barYearBin, setBarYearBin] = useState<[number, number] | null>(null)
  const [lineYearBin, setLineYearBin] = useState<[number, number] | null>(null)
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null)
  const [lineResetToken, setLineResetToken] = useState(0)

  // When streamgraph bin is clicked, update BOTH charts by default
  function handleSelectFromStream(bin: [number, number] | null) {
    setBarYearBin(bin)
    setLineYearBin(bin)
    setSelectedGenre(null)
  }

  return (
    <Box id="main-container">
      <Stack spacing={1} sx={{ height: '100%' }}>
        {/* Dashboard Title */}
        <Box
          sx={{
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Typography sx={{ fontSize: '1.3rem', fontWeight: 'bold' }}>
            Spotify Music Track Genre and Duration Change Over Time
          </Typography>
        </Box>
        {/* Top half */}
        <Grid container spacing={1} sx={{ flex: 1, minHeight: 0 }}>
          <Grid size={12} sx={{ height: '100%' }}>
            <StreamGraphView
              selectedYearBin={barYearBin} // just for visual highlight in streamgraph (pick one)
              onSelectYearBin={handleSelectFromStream}
            />
          </Grid>
        </Grid>

        {/* Bottom half */}
        <Grid container spacing={1} sx={{ flex: 1, minHeight: 0 }}>
          {/* Left: Bar */}
          <Grid size={6} sx={{ height: '100%' }}>
            <Stack spacing={1} sx={{ height: '100%' }}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    setBarYearBin(null)
                    setSelectedGenre(null)
                  }}
                  disabled={barYearBin === null}
                  sx={{ position: 'relative', top: 20, left: -30 }}
                >
                  Default (All Time)
                </Button>
              </Box>

              <Box sx={{ flex: 1, minHeight: 0 }}>
                <BarView 
                  selectedYearBin={barYearBin} 
                  selectedGenre={selectedGenre}
                  onSelectGenre={setSelectedGenre}/>
              </Box>
            </Stack>
          </Grid>

          {/* Right: Line */}
          <Grid size={6} sx={{ height: '100%' }}>
            <Stack spacing={1} sx={{ height: '100%' }}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    setLineYearBin(null)
                    setSelectedGenre(null)
                    setLineResetToken(prev => prev + 1) // force line chart to reset animation
                  }}
                  disabled={lineYearBin === null}
                  sx={{ position: 'relative', top: 20, left: -30 }}
                >
                  Default (All Time)
                </Button>
              </Box>

              <Box sx={{ flex: 1, minHeight: 0 }}>
                <LineChartView 
                  selectedYearBin={lineYearBin} 
                  selectedGenre={selectedGenre} 
                  resetToken={lineResetToken}
                  />
              </Box>
            </Stack>
          </Grid>
        </Grid>
      </Stack>
    </Box>
  )
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <Layout />
    </ThemeProvider>
  )
}

export default App
