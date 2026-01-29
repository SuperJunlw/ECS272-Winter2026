import BarView from './components/BarView'
import ScatterPlotView from './components/ScatterPlotView';
import ParallelCoordsView from './components/ParallelCoordsView';
import StreamGraphView from './components/StreamGraphView';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { grey } from '@mui/material/colors';

// Adjust the color theme for material ui
const theme = createTheme({
  palette: {
    primary:{
      main: grey[700],
    },
    secondary:{
      main: grey[700],
    }
  },
})

// For how Grid works, refer to https://mui.com/material-ui/react-grid/

function Layout() { 
  return ( 
  <Box id="main-container">
    <Stack spacing={1} sx={{ height: '100%' }}> 
    {/* Top half: bar chart, full width */} 
    <Grid container spacing={1} sx={{ height: '50%' }}> 
        <Grid size={12} sx={{ height: '100%' }}> 
          <BarView/> 
        </Grid> 
      </Grid> 

    {/* Bottom half*/}
      <Grid container spacing={1} sx={{ height: '50%' }}>
        <Grid size={6} sx={{ height: '100%' }}>
          <ScatterPlotView /> 
        </Grid> 
        <Grid size={6} sx={{ height: '100%' }}>
          <ParallelCoordsView /> 
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
