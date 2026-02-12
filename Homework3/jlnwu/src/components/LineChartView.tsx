import React from 'react'
import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { isEmpty } from 'lodash'
import { useResizeObserver, useDebounceCallback } from 'usehooks-ts'

import { ComponentSize, Margin } from '../types'

// shows a line chart of average track duration by year, filtered to the selected year bin from StreamGraphView
type Props = {
  selectedYearBin: [number, number] | null
  selectedGenre: string | null
  resetToken: number
}

// one row per track that meets popularity threshold, with one genre per row
type EventRow = {
  year: number
  dur: number
  genres: string[]
}

// line chart data, one point per year with average track duration for that year
type YearPoint = {
  year: number
  avg_duration: number
}

type Series = {
  all: YearPoint[]
  genre: YearPoint[] // empty when selectedGenre is null
}

export default function LineChartView({ selectedYearBin, selectedGenre, resetToken }: Props) {
  const [events, setEvents] = useState<EventRow[]>([])
  const [series, setSeries] = useState<Series>({ all: [], genre: [] })
  const [colorMap, setColorMap] = useState<Map<string, string>>(new Map())

  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<ComponentSize>({ width: 0, height: 0 })
  const margin: Margin = { top: 40, right: 20, bottom: 45, left: 70 }
  const onResize = useDebounceCallback((s: ComponentSize) => setSize(s), 200)
  const lastAnimKeyRef = useRef<string | null>(null)

  useResizeObserver({ ref: containerRef as React.RefObject<HTMLDivElement>, onResize })

  // helper to parse year from album_release_date
  function parseYear(dateStr: string | undefined): number | null {
    if (!dateStr) return null
    const s = dateStr.trim()
    if (!s) return null
    if (/^\d{4}$/.test(s)) return +s

    const parse1 = d3.timeParse('%Y-%m-%d')
    const parse2 = d3.timeParse('%Y/%m/%d')
    const dt = parse1(s) ?? parse2(s)
    return dt ? dt.getFullYear() : null
  }

  function extractGenres(raw: string | undefined): string[] {
    if (!raw) return []
    const s = raw.trim()
    if (!s) return []
    if (s.toLowerCase() === 'n/a') return []
    return s
      .split(',')
      .map(g => g.trim().toLowerCase())
      .filter(g => g.length > 0 && g !== 'n/a')
  }

  function animatePath(p: d3.Selection<SVGPathElement, unknown, any, any>, duration = 1500, finalDash: string | null = null) {
      p.interrupt()
      const node = p.node()
      if (!node) return
      const len = node.getTotalLength()

      p.attr('stroke-dasharray', `${len} ${len}`)
        .attr('stroke-dashoffset', len)
        .attr('stroke-linecap', 'round')
        .transition()
        .duration(duration)
        .ease(d3.easeLinear)
        .attr('stroke-dashoffset', 0)
        .on('end', () => {
          if (finalDash) p.attr('stroke-dasharray', finalDash)
          else p.attr('stroke-dasharray', null)
        })
    }


  // load and preprocess data
  useEffect(() => {
    const load = async () => {
      try {
        const rows = await d3.csv('../../data/spotify_data clean.csv', (d: any) => ({
          year: d.album_release_date,
          pop: +d.track_popularity,
          dur: +d.track_duration_min, // uses minutes column
          genres: d.artist_genres
        }))

        const evts: EventRow[] = []

        for (const r of rows as any[]) {
          if (!Number.isFinite(r.pop)) continue

          const y = parseYear(r.year)
          if (y === null) continue
          if (y < 1990 || y > 2025) continue

          if (!Number.isFinite(r.dur)) continue
          const gs = extractGenres(r.genres)
          if (gs.length === 0) continue

          evts.push({ year: y, dur: r.dur, genres: gs })
        }

        // Build the same color mapping as BarView
        const allGenres = evts.flatMap(e => e.genres)

        const globalTotals = d3.rollups(
          allGenres,
          v => v.length,
          d => d
        )
        globalTotals.sort((a, b) => d3.descending(a[1], b[1]))
        const globalTop10 = globalTotals.slice(0, 10).map(d => d[0])

        const globalColor = d3
          .scaleOrdinal<string>()
          .domain(globalTop10)
          .range(d3.schemeTableau10)

        const cmap = new Map<string, string>()
        for (const g of globalTop10) cmap.set(g, globalColor(g) as string)

        // keep your special override if you want
        if (cmap.has('soft pop')) cmap.set('soft pop', '#c7c7ff')

        setColorMap(cmap)

        setEvents(evts)
      } catch (err) {
        console.error('Error loading CSV for LineChartView:', err)
      }
    }

    load()
  }, [])

  // recompute averages based on selected bin
  useEffect(() => {
      if (isEmpty(events)) return

      const [start, end] = selectedYearBin ?? [1990, 2025]
      const inBin = events.filter(e => e.year >= start && e.year <= end)

      // baseline line: all tracks
      const rolledAll = d3.rollups(
        inBin,
        v => d3.mean(v, d => d.dur) ?? 0,
        d => d.year
      )

      const allPts: YearPoint[] = rolledAll
        .map(([year, avg]) => ({ year: year as number, avg_duration: avg as number }))
        .sort((a, b) => a.year - b.year)

      // overlay line: selected genre only
      let genrePts: YearPoint[] = []
      if (selectedGenre) {
        const g = selectedGenre.toLowerCase()
        const inGenre = inBin.filter(e => e.genres.includes(g))

        const rolledGenre = d3.rollups(
          inGenre,
          v => d3.mean(v, d => d.dur) ?? 0,
          d => d.year
        )

        genrePts = rolledGenre
          .map(([year, avg]) => ({ year: year as number, avg_duration: avg as number }))
          .sort((a, b) => a.year - b.year)
      }

      setSeries({ all: allPts, genre: genrePts })
    }, [events, selectedYearBin, selectedGenre])


    // render
    useEffect(() => {
      if (isEmpty(series.all)) return
      if (size.width === 0 || size.height === 0) return

      const binKey = selectedYearBin ? `${selectedYearBin[0]}-${selectedYearBin[1]}` : 'ALL'
      const animKey = `${binKey}|reset:${resetToken}`

      const animateBase = lastAnimKeyRef.current !== animKey
      lastAnimKeyRef.current = animKey

      const svg = d3.select('#duration-line-svg')
      svg.selectAll('*').interrupt()       // stop old transitions
      svg.selectAll('*').remove()

      initChart(animateBase)
    }, [series, size, colorMap, resetToken])


    useEffect(() => {
      if (isEmpty(series.all)) return
      if (size.width === 0 || size.height === 0) return

      const svg = d3.select('#duration-line-svg')

      // remove previous overlay only 
      svg.selectAll('.overlay-line').remove()
      svg.selectAll('.genre-dot').remove()

      // if no genre selected, stop here
      if (!selectedGenre || isEmpty(series.genre)) return

      const allData = series.all
      const genreData = series.genre

      const overlayColor =
        colorMap.get(selectedGenre.toLowerCase()) ?? '#7a7a7a'

      const xDomain: [number, number] = selectedYearBin ?? [1990, 2025]

      const combined = allData.concat(genreData)
      const yMin = d3.min(combined, d => d.avg_duration) ?? 0
      const yMax = d3.max(combined, d => d.avg_duration) ?? 1

      const xScale = d3
        .scaleLinear()
        .domain(xDomain)
        .range([margin.left, size.width - margin.right])

      const yScale = d3
        .scaleLinear()
        .domain([Math.max(0, yMin * 0.98), yMax * 1.02])
        .nice()
        .range([size.height - margin.bottom, margin.top])

      const line = d3
        .line<YearPoint>()
        .x(d => xScale(d.year))
        .y(d => yScale(d.avg_duration))
        .curve(d3.curveMonotoneX)

      // overlay path (animate ONLY this one)
      const overlayPath = svg
        .append('path')
        .datum(genreData)
        .attr('class', 'overlay-line')
        .attr('fill', 'none')
        .attr('stroke', overlayColor)
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5 4')
        .attr('d', line)

      animatePath(overlayPath, 1500, '5 4')

      // overlay dots
      svg
        .append('g')
        .selectAll('circle.genre-dot')
        .data(genreData)
        .join('circle')
        .attr('class', 'genre-dot')
        .attr('cx', d => xScale(d.year))
        .attr('cy', d => yScale(d.avg_duration))
        .attr('r', 2.5)
        .attr('fill', overlayColor)
        .attr('opacity', 0.9)
    }, [selectedGenre, series.genre, series.all, size, selectedYearBin, colorMap])

  function initChart(animateBase: boolean) {
    
    const svg = d3.select('#duration-line-svg')

    const allData = series.all
    const genreData = series.genre

    const overlayColor = selectedGenre ? (colorMap.get(selectedGenre.toLowerCase()) ?? '#7a7a7a') : '#7a7a7a'

    // x scale based on selected year bin
    const xDomain: [number, number] = selectedYearBin ?? [1990, 2025]

    // y scale based on min/max avg duration in data
    const combined = genreData.length ? allData.concat(genreData) : allData
    const yMin = d3.min(combined, d => d.avg_duration) ?? 0
    const yMax = d3.max(combined, d => d.avg_duration) ?? 1


    // scales
    const xScale = d3
      .scaleLinear()
      .domain(xDomain)
      .range([margin.left, size.width - margin.right])

    const yScale = d3
      .scaleLinear()
      .domain([Math.max(0, yMin * 0.98), yMax * 1.02])
      .nice()
      .range([size.height - margin.bottom, margin.top])

    const line = d3
      .line<YearPoint>()
      .x(d => xScale(d.year))
      .y(d => yScale(d.avg_duration))
      .curve(d3.curveMonotoneX)


    // line, animated draw left to right
    // create path first to get total length for animation

    const basePath = svg
      .append('path')
      .datum(allData)
      .attr('class', 'base-line')
      .attr('fill', 'none')
      .attr('stroke', '#555')
      .attr('stroke-width', 2)
      .attr('d', line)

    if (animateBase) {
      animatePath(basePath, 1500, null)
    } else {
      // ensure it doesn't keep any dash settings
      basePath.attr('stroke-dasharray', null).attr('stroke-dashoffset', null)
    }

    // dots at each point
    svg
      .append('g')
      .selectAll('circle')
      .data(allData)
      .join('circle')
      .attr('cx', d => xScale(d.year))
      .attr('cy', d => yScale(d.avg_duration))
      .attr('r', 2.5)
      .attr('fill', '#555')
      .attr('opacity', 0.8)

    // Legend
    const lineLen = 26
    const rowH = 16
    const padX = 10
    const padY = 8

    const legendItems: Array<{ label: string; color: string; dashed: boolean }> = [
      { label: 'All genres', color: '#555', dashed: false }
    ]

    if (selectedGenre && genreData.length) {
      legendItems.push({ label: selectedGenre, color: overlayColor, dashed: true })
    }

    const legendW = 160
    const legendH = padY * 2 + legendItems.length * rowH

    const legendX = size.width - margin.right - legendW - 8
    const legendY = margin.top + 6

    const legend = svg
      .append('g')
      .attr('class', 'line-legend')
      .attr('transform', `translate(${legendX}, ${legendY})`)

    // background box
    legend
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', legendW)
      .attr('height', legendH)
      .attr('rx', 10)
      .attr('fill', 'white')
      .attr('opacity', 0.85)
      .attr('stroke', 'rgba(0,0,0,0.15)')

    // items
    const itemG = legend
      .selectAll('g.legend-item')
      .data(legendItems)
      .join('g')
      .attr('class', 'legend-item')
      .attr('transform', (_d, i) => `translate(${padX}, ${padY + i * rowH})`)

    itemG
      .append('line')
      .attr('x1', 0)
      .attr('y1', 7)
      .attr('x2', lineLen)
      .attr('y2', 7)
      .attr('stroke', d => d.color)
      .attr('stroke-width', 2)
      .attr('stroke-linecap', 'round')
      .attr('stroke-dasharray', d => (d.dashed ? '5 4' : 'none'))


    itemG
      .append('circle')
      .attr('cx', lineLen)
      .attr('cy', 7)
      .attr('r', 2.5)
      .attr('fill', d => d.color)
      .attr('opacity', 0.9)

    itemG
      .append('text')
      .attr('x', lineLen + 8)
      .attr('y', 7)
      .attr('dominant-baseline', 'middle')
      .style('font-size', '11px')
      .style('opacity', 0.85)
      .text(d => d.label)


    // axes
    svg
      .append('g')
      .attr('transform', `translate(0, ${size.height - margin.bottom})`)
      .call(d3.axisBottom(xScale).ticks(5).tickFormat(d3.format('d')))

    svg
      .append('g')
      .attr('transform', `translate(${margin.left}, 0)`)
      .call(d3.axisLeft(yScale).ticks(5))

    const baseTitle =
      selectedYearBin === null
        ? 'Average Track Duration by Year (1990–2025)'
        : `Average Track Duration by Year (${selectedYearBin[0]}–${selectedYearBin[1]})`

    const title = selectedGenre ? `${baseTitle} — ${selectedGenre}` : baseTitle

    svg
      .append('text')
      .attr('x', margin.left)
      .attr('y', margin.top - 14)
      .style('font-weight', 'bold')
      .style('font-size', '1rem')
      .text(title)

    svg
      .append('text')
      .attr('x', (margin.left + (size.width - margin.right)) / 2)
      .attr('y', size.height - 10)
      .style('text-anchor', 'middle')
      .style('font-size', '.9rem')
      .text('Year')

    svg
      .append('text')
      .attr('x', -(size.height / 2))
      .attr('y', 18)
      .attr('transform', 'rotate(-90)')
      .style('text-anchor', 'middle')
      .style('font-size', '.9rem')
      .text('Average Track Duration (min)')
  }

  return (
    <div
      ref={containerRef}
      className="chart-container"
      style={{ position: 'relative', width: '100%', height: '100%' }}
    >
      <svg id="duration-line-svg" width="100%" height="100%" />
    </div>
  )
}
