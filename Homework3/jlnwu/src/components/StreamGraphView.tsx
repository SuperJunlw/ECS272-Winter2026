// Overall view: Streamgraph of Top 10 Genres Over All Time (Tracks with popularity >= 40)
// - X: year (album_release_date)
// - Y: stacked counts (wiggle offset streamgraph)
// - Layers: top 10 genres (counting ALL genres in artist_genres string)

import React from 'react'
import { useEffect, useState, useRef } from 'react'
import * as d3 from 'd3'
import { isEmpty } from 'lodash'
import { useResizeObserver, useDebounceCallback } from 'usehooks-ts'

import { ComponentSize, Margin } from '../types'

//represent how many track belong to this genre in this year
type StreamPoint = {
  year: number
  genre: string
  count: number
}

type Props = {
  //select a year bin on the graph 
  selectedYearBin: [number, number] | null

  //callback when a year bin is selected, used to filter other views
  onSelectYearBin: (bin: [number, number] | null) => void
}

export default function StreamGraphView({ selectedYearBin, onSelectYearBin }: Props) {
  const [points, setPoints] = useState<StreamPoint[]>([])
  const streamRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<ComponentSize>({ width: 0, height: 0 })
  const margin: Margin = { top: 40, right: 20, bottom: 50, left: 60 }
  const onResize = useDebounceCallback((s: ComponentSize) => setSize(s), 200)

  useResizeObserver({ ref: streamRef as React.RefObject<HTMLDivElement>, onResize })

  // helper to parse year from album_release_date
  function parseYear(dateStr: string | undefined): number | null {
    if (!dateStr) return null
    const s = dateStr.trim()
    if (!s) return null

    // "YYYY"
    if (/^\d{4}$/.test(s)) return +s

    // "YYYY-MM-DD"
    const parse1 = d3.timeParse('%Y-%m-%d')
    const parse2 = d3.timeParse('%Y/%m/%d')
    const dt = parse1(s) ?? parse2(s)
    return dt ? dt.getFullYear() : null
  }

  // extract multiple genres from a string like pop, rock, rap
  function extractGenres(raw: string | undefined): string[] {
    if (!raw) return []
    const s = raw.trim()
    if (!s) return []
    if (s.toLowerCase() === 'n/a') return []

    // format: "pop, rock, rap"
    return s
      .split(',')
      .map(g => g.trim().toLowerCase())
      .filter(g => g.length > 0 && g !== 'n/a')
  }

  // load and preprocess data 
  useEffect(() => {
    const dataFromCSV = async () => {
      try {
        const rows = await d3.csv('../../data/spotify_data clean.csv', (d: any) => {
          return {
            year: d.album_release_date,
            genres: d.artist_genres,        
            pop: +d.track_popularity
          }
        })

        // Build (year, genre) events, counting all genres per track
        const events: Array<{ year: number; genre: string }> = []

        for (const r of rows as any[]) {
            if (!Number.isFinite(r.pop)) continue

            const year = parseYear(r.year)
            if (year === null) continue
            if (year < 1990) continue // filter out very old tracks

            // Extract genre, can have multiple genres per track
            const genres = extractGenres(r.genres)
            if (genres.length === 0) continue

            //push one event per genre for this track
            for (const g of genres) {
                events.push({ year, genre: g })
            }
        }


        // print top 10 genre totals 
        const genreTotals = d3.rollups(
            events,
            v => v.length,
            d => d.genre
        )

        genreTotals.sort((a, b) => d3.descending(a[1], b[1]))

        // Aggregate into counts by (year, genre)
        const rolled = d3.rollups(
          events,
          v => v.length,
          d => d.year,
          d => d.genre
        )

        // flatten to StreamPoint[]
        const out: StreamPoint[] = []
        for (const [year, genrePairs] of rolled) {
          for (const [genre, count] of genrePairs) {
            out.push({ year, genre, count })
          }
        }

        setPoints(out)
      } catch (error) {
        console.error('Error loading CSV:', error)
      }
    }

    dataFromCSV()
  }, [])

  // render chart when data or size changes
  useEffect(() => {
    if (isEmpty(points)) return
    if (size.width === 0 || size.height === 0) return

    d3.select('#stream-svg').selectAll('*').remove()
    initChart()
    }, [points, size, selectedYearBin])


  function initChart() {
    const chartContainer = d3.select('#stream-svg')

    // Top 10 genres overall (by total count)
    // sum counts across all years to find top genres
    const totals = d3.rollups(
      points,
      v => d3.sum(v, d => d.count),
      d => d.genre
    )

    // sort descending and take top 10
    totals.sort((a, b) => d3.descending(a[1], b[1]))
    const topGenres = totals.slice(0, 10).map(d => d[0])

    // for tooltip display on hover
    const totalCountByGenre = new Map<string, number>(
        totals.map(([g, c]) => [g as string, c as number])
    )

    const filtered = points.filter(d => topGenres.includes(d.genre))

    // find unique years in the data, to determine x-axis domain and bins
    const years = Array.from(new Set(filtered.map(d => d.year))).sort((a, b) => a - b)
    if (years.length === 0) return

    // Build 5-year bins 
    const minYear = d3.min(years) as number
    const maxYear = d3.max(years) as number

    // force showing 2025 on the axis/bins:
    const binMaxYear = Math.max(maxYear, 2025)

    // align bins to multiples of 5
    const start = Math.floor(minYear / 5) * 5

    // last bin should start at 2020 when binMaxYear=2025
    let lastBinStart = Math.floor(binMaxYear / 5) * 5
    if (binMaxYear % 5 === 0) lastBinStart -= 5

    const binStarts = d3.range(start, lastBinStart + 1, 5)

    // create bins like {start: 1990, end: 1994}
    const yearBins: Array<{ start: number; end: number }> = binStarts
    .map(s => ({ start: s, end: Math.min(s + 4, binMaxYear) }))
    .filter(b => b.end >= minYear && b.start <= binMaxYear)

    // Transform data to wide format for stacking
    //{ year: 1990, pop: 100, rock: 50, rap: 30}}
    const wideRows: Array<Record<string, number>> = years.map(y => {
      const row: Record<string, number> = { year: y }
      for (const g of topGenres) row[g] = 0
      return row
    })

    const rowByYear = new Map<number, Record<string, number>>(wideRows.map(r => [r.year as number, r]))

    // fill wide rows with counts
    for (const d of filtered) {
      const row = rowByYear.get(d.year)
      if (!row) continue
      row[d.genre] = (row[d.genre] ?? 0) + d.count
    }

    // scales
    const xScale = d3
      .scaleLinear()
      .domain([minYear, binMaxYear])
      .range([margin.left, size.width - margin.right])

    // stack generator with wiggle offset for streamgraph
    const stack = d3
      .stack<Record<string, number>>()
      .keys(topGenres)
      .offset(d3.stackOffsetWiggle)

    const series = stack(wideRows)

    // find y domain across all layers
    const yMin = d3.min(series, s => d3.min(s, d => d[0])) ?? 0
    const yMax = d3.max(series, s => d3.max(s, d => d[1])) ?? 0

    const extraGap = 26

    const yScale = d3
      .scaleLinear()
      .domain([yMin, yMax])
      .nice()
      .range([size.height - margin.bottom - extraGap, margin.top])

    // 10 colors for 10 layers
    const base = [...d3.schemeTableau10] 
    const idxSoft = topGenres.indexOf('soft pop')
    if (idxSoft !== -1) base[idxSoft] = '#c7c7ff' // light lavender

    const colorScale = d3
      .scaleOrdinal<string>()
      .domain(topGenres)
      .range(base)

    // area generator for streamgraph layers
    const area = d3
      .area<d3.SeriesPoint<Record<string, number>>>()
      .x(d => xScale(d.data.year as number))
      .y0(d => yScale(d[0]))
      .y1(d => yScale(d[1]))
      .curve(d3.curveCatmullRom.alpha(0.5))

    // Tooltip, attach to body to avoid hover flicker
    d3.select('body').selectAll('.stream-tooltip').remove()

    const tooltip = d3
    .select('body')
    .append('div')
    .attr('class', 'stream-tooltip')
    .style('position', 'fixed')
    .style('pointer-events', 'none')
    .style('z-index', '9999')
    .style('opacity', 0)
    .style('background', 'white')
    .style('border', '1px solid #ddd')
    .style('border-radius', '8px')
    .style('padding', '6px 10px')
    .style('font-size', '12px')
    .style('box-shadow', '0 2px 8px rgba(0,0,0,0.12)')

    // Draw layers 
    const layers = chartContainer
    .append('g')
    .selectAll('path')
    .data(series)
    .join('path')
    .attr('d', area)
    .attr('fill', (s: any) => colorScale(s.key) as string)
    .attr('opacity', 0.9)
    .attr('stroke', 'none')
    .attr('stroke-width', 0)
    .style('cursor', 'pointer')

    // Hover interactions
    layers
    .on('mouseenter', function (event: MouseEvent, s: any) {
        // stop any in-flight animations
        layers.interrupt()

        // fade others immediately
        layers.attr('opacity', 0.15).attr('stroke', 'none').attr('stroke-width', 0)

        // highlight current
        d3.select(this)
        .raise()
        .attr('opacity', 1)
        .attr('stroke', '#111')
        .attr('stroke-width', 1.2)

        const total = totalCountByGenre.get(s.key) ?? 0
        tooltip
            .style('opacity', 1)
            .html(`
                <div><b>Genre:</b> ${s.key}</div>
                <div><b>Total count:</b> ${d3.format(',')(total)}</div>
            `)
        })
    .on('mousemove', function (event: MouseEvent) {
        tooltip
        .style('left', `${event.clientX + 14}px`)
        .style('top', `${event.clientY + 14}px`)
    })
    .on('mouseleave', function () {
        layers.interrupt().attr('opacity', 0.9).attr('stroke', 'none').attr('stroke-width', 0)
        tooltip.style('opacity', 0)
    })

    // 5-year hover/click zones near x-axis
    const zoneTop = size.height - margin.bottom
    const zoneHeight = 18

    const zonesG = chartContainer.append('g').attr('class', 'year-zones')

    // Rectangles act as invisible hitboxes
    const zones = zonesG
      .selectAll('rect')
      .data(yearBins)
      .join('rect')
      .attr('x', d => xScale(d.start))
      .attr('y', zoneTop - zoneHeight)
      .attr('width', d => {
          const x0 = xScale(d.start)
          const nextBoundary = Math.min(d.end + 1, binMaxYear)
          const x1 = xScale(nextBoundary)
          return Math.max(8, x1 - x0) // minimum click width
          })

      .attr('height', zoneHeight)
      .attr('rx', 4)
      .attr('ry', 4)
      .attr('fill', d =>
      selectedYearBin && d.start === selectedYearBin[0] && d.end === selectedYearBin[1]
          ? 'rgba(0,0,0,0.14)'   // selected fill
          : 'rgba(0,0,0,0.06)'   // normal fill
      )
      .attr('stroke', d =>
      selectedYearBin && d.start === selectedYearBin[0] && d.end === selectedYearBin[1]
          ? '#111'               // selected border
          : 'rgba(0,0,0,0.25)'   // normal border
      )
      .attr('stroke-width', d =>
      selectedYearBin && d.start === selectedYearBin[0] && d.end === selectedYearBin[1]
          ? 2
          : 1
      )
      .style('cursor', 'pointer')

    // small labels at each bin start
    zonesG
    .selectAll('text')
    .data(yearBins)
    .join('text')
    .attr('x', d => xScale(d.start) + 2)
    .attr('y', zoneTop - 4)
    .style('font-size', '10px')
    .style('opacity', 0.6)
    .text(d => `${d.start}–${d.end}`)

    // Hover and click behavior
    zones
    .on('mouseenter', function (event: MouseEvent, b) {
        d3.select(this).attr('fill', 'rgba(0,0,0,0.12)')

        tooltip
        .style('opacity', 1)
        .html(`<div><b>Year bin:</b> ${b.start}–${b.end}</div><div>Click to filter</div>`)
    })
    .on('mousemove', function (event: MouseEvent) {
        tooltip.style('left', `${event.clientX + 14}px`).style('top', `${event.clientY + 14}px`)
    })
    .on('mouseleave', function (event: MouseEvent, b) {
        const isSelected =
        selectedYearBin && b.start === selectedYearBin[0] && b.end === selectedYearBin[1]

        d3.select(this).attr('fill', isSelected ? 'rgba(0,0,0,0.14)' : 'rgba(0,0,0,0.06)')
        tooltip.style('opacity', 0)
    })
    .on('click', function (event: MouseEvent, b) {
        onSelectYearBin([b.start, b.end])
    })

    chartContainer
    .append('text')
    .attr('x', margin.left)
    .attr('y', zoneTop - zoneHeight - 6)
    .style('font-size', '12px')
    .style('opacity', 0.75)
    .text('Click a year bin to filter the other views')


    // axes
    chartContainer
      .append('g')
      .attr('transform', `translate(0, ${size.height - margin.bottom})`)
      .call(d3.axisBottom(xScale).ticks(6).tickFormat(d3.format('d')))

    chartContainer
      .append('g')
      .attr('transform', `translate(${margin.left}, 0)`)
      .call(d3.axisLeft(yScale).ticks(5).tickFormat(d => d3.format('d')(Math.abs(Number(d)))))

    // labels + title
    chartContainer
      .append('g')
      .append('text')
      .attr('x', size.width / 2)
      .attr('y', size.height - 15)
      .style('text-anchor', 'middle')
      .style('font-size', '.9rem')
      .text('Year')

    chartContainer
      .append('g')
      .append('text')
      .attr('x', -(size.height / 2))
      .attr('y', margin.left / 2.2)
      .attr('transform', 'rotate(-90)')
      .style('text-anchor', 'middle')
      .style('font-size', '.9rem')
      .text('Track Count')

    chartContainer
      .append('g')
      .append('text')
      .attr('x', size.width / 2)
      .attr('y', margin.top / 2)
      .style('text-anchor', 'middle')
      .style('font-weight', 'bold')
      .style('font-size', '1rem')
      .text('Genre Streamgraph Over Time (Top 10 Genres)')

    // Legend
    const legendPaddingX = 5
    const legendPaddingY = 10
    const rowH = 15
    const swatch = 12
    const labelGap = 6
    const colGap = 2
    const cols = 2

    const items = topGenres
    const rows = Math.ceil(items.length / cols)

    // column width 
    const colW = 120

    // place inside plot area, top-left
    const legendX = margin.left + 70
    const legendY = margin.top

    const legend = chartContainer
      .append('g')
      .attr('class', 'stream-legend')
      .attr('transform', `translate(${legendX}, ${legendY})`)

    // soft shadow filter 
    const svg = d3.select('#stream-svg')
    svg.select('defs').empty() && svg.append('defs')

    svg.select('defs')
      .selectAll('#legendShadow')
      .data([null])
      .join('filter')
      .attr('id', 'legendShadow')
      .attr('x', '-20%')
      .attr('y', '-20%')
      .attr('width', '140%')
      .attr('height', '140%')
      .html(`<feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.18"/>`)

    const title = 'Top Genres'
    const titleH = 16

    const boxW = legendPaddingX * 2 + cols * colW + (cols - 1) * colGap
    const boxH = legendPaddingY * 2 + titleH + rows * rowH

    // background box
    legend
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', boxW)
      .attr('height', boxH)
      .attr('rx', 12)
      .attr('fill', 'white')
      .attr('opacity', 0.82)
      .attr('filter', 'url(#legendShadow)')

    // title
    legend
      .append('text')
      .attr('x', legendPaddingX)
      .attr('y', legendPaddingY + 2)
      .style('font-size', '12px')
      .style('font-weight', '600')
      .text(title)

    // items 
    const legendItems = legend
      .selectAll('.legend-item')
      .data(items)
      .join('g')
      .attr('class', 'legend-item')
      .attr('transform', (d, i) => {
        const col = i % cols
        const row = Math.floor(i / cols)
        const x = legendPaddingX + col * (colW + colGap)
        const y = legendPaddingY + titleH + row * rowH
        return `translate(${x}, ${y})`
      })

    
    legendItems
      .append('rect')
      .attr('x', 0)
      .attr('y', -10)
      .attr('width', swatch)
      .attr('height', swatch)
      .attr('rx', 2)
      .attr('fill', d => colorScale(d) as string)

    legendItems
      .append('text')
      .attr('x', swatch + labelGap)
      .attr('y', 0)
      .style('font-size', '11px')
      .attr('dominant-baseline', 'middle')
      .text(d => d)

  }

  return (
        <div ref={streamRef} className='chart-container' style={{ position: 'relative' }}>
            <svg id='stream-svg' width='100%' height='100%'></svg>
        </div>
)
}
