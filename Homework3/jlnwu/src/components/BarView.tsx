import React from 'react'
import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { isEmpty } from 'lodash'
import { useResizeObserver, useDebounceCallback } from 'usehooks-ts'

import { ComponentSize, Margin } from '../types'

// shows a bar chart of the top 10 genres within the selected year bin from StreamGraphView
// each genre can be selected to filter the LineChartView below to that genre
type Props = {
  selectedYearBin: [number, number] | null
  selectedGenre: string | null
  onSelectGenre: (g: string | null) => void
}

// one row per track that meets popularity threshold, with one genre per row 
// so tracks with multiple genres will have multiple rows
type EventRow = {
  year: number
  genre: string
}

// Bar chart data - aggregated totals for one genre.
type BarDatum = {
  genre: string
  count: number
}

export default function BarView({ selectedYearBin, selectedGenre, onSelectGenre }: Props)  {
  const [events, setEvents] = useState<EventRow[]>([])
  const [data, setData] = useState<BarDatum[]>([])
  const [colorMap, setColorMap] = useState<Map<string, string>>(new Map())

  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<ComponentSize>({ width: 0, height: 0 })
  const margin: Margin = { top: 40, right: 20, bottom: 45, left: 120 }
  const onResize = useDebounceCallback((s: ComponentSize) => setSize(s), 200)

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

  // extract multiple genres from a string like pop, rock, rap
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

  // load and preprocess data 
  useEffect(() => {
    const load = async () => {
      try {
        const rows = await d3.csv('../../data/spotify_data clean.csv', (d: any) => ({
          year: d.album_release_date,
          genres: d.artist_genres,
          pop: +d.track_popularity
        }))

        const evts: EventRow[] = []

        // parse and filter data
        for (const r of rows as any[]) {
          if (!Number.isFinite(r.pop)) continue
          const y = parseYear(r.year)
          if (y === null) continue
          if (y < 1990) continue

          const gs = extractGenres(r.genres)
          if (gs.length === 0) continue

          for (const g of gs) evts.push({ year: y, genre: g })
        }

        // Global top genres for stable color mapping
        const globalTotals = d3.rollups(
          evts,
          v => v.length,
          d => d.genre
        )
        globalTotals.sort((a, b) => d3.descending(a[1], b[1]))
        const globalTop10 = globalTotals.slice(0, 10).map(d => d[0])

        const globalColor = d3
          .scaleOrdinal<string>()
          .domain(globalTop10)
          .range(d3.schemeTableau10)

        // create color map for global top 10 genres, others will default to gray
        const cmap = new Map<string, string>()
        for (const g of globalTop10) cmap.set(g, globalColor(g) as string)
        
        // override
        if (cmap.has('soft pop')) cmap.set('soft pop', '#c7c7ff')

        setEvents(evts)
        setColorMap(cmap)
      } catch (err) {
        console.error('Error loading CSV for BarView:', err)
      }
    }

    load()
  }, [])

  // recompute top10 within selected bin 
  useEffect(() => {
    if (isEmpty(events)) return

    // if no bin selected, show all from 1990 onwards
    const [start, end] = selectedYearBin ?? [1990, Number.POSITIVE_INFINITY]

    // filter to selected year range, then aggregate counts by genre
    const filtered = events.filter(e => e.year >= start && e.year <= end)

    // aggregate counts by genre
    const totals = d3.rollups(
      filtered,
      v => v.length,
      d => d.genre
    )
    totals.sort((a, b) => d3.descending(a[1], b[1]))

    // take top 10 genres in this bin
    const top10 = totals.slice(0, 10).map(([genre, count]) => ({
      genre,
      count
    }))

    setData(top10)
  }, [events, selectedYearBin])

  // render
  useEffect(() => {
    if (isEmpty(data)) return
    if (size.width === 0 || size.height === 0) return

    d3.select('#genre-bar-svg').selectAll('*').remove()
    initChart()
  }, [data, size, colorMap, selectedYearBin])

  useEffect(() => {
    const svg = d3.select('#genre-bar-svg')

    // Update bars
    svg
      .selectAll<SVGRectElement, BarDatum>('g.bars rect')
      .attr('stroke', d => (d.genre === selectedGenre ? '#111' : 'none'))
      .attr('stroke-width', d => (d.genre === selectedGenre ? 2 : 0))
      .attr('opacity', 0.95)
  }, [selectedGenre])

  const selectedGenreRef = useRef<string | null>(null)

  useEffect(() => {
    selectedGenreRef.current = selectedGenre
  }, [selectedGenre])

  function initChart() {
    const svg = d3.select('#genre-bar-svg')

    // x scale based on max count in data
    const xMax = d3.max(data, d => d.count) ?? 0
    const xScale = d3
      .scaleLinear()
      .domain([0, xMax])
      .nice()
      .range([margin.left, size.width - margin.right])

    // y scale based on genres in data
    const yScale = d3
      .scaleBand<string>()
      .domain(data.map(d => d.genre))
      .range([margin.top, size.height - margin.bottom])
      .padding(0.18)

    // animation
    const t = d3.transition().duration(1000).ease(d3.easeSinOut)

    // Bars, animate width from 0 to final width
    const barsG = svg.append('g').attr('class', 'bars')

    const bars = barsG
      .selectAll<SVGRectElement, BarDatum>('rect')
      .data(data, (d: any) => d.genre)
      .join(enter =>
        enter
          .append('rect')
          .attr('x', xScale(0))
          .attr('y', d => yScale(d.genre) ?? 0)
          .attr('height', yScale.bandwidth())
          .attr('width', 0)
          .attr('fill', d => colorMap.get(d.genre) ?? 'rgba(0,0,0,0.35)')
          .attr('opacity', 0.95)
          .call(enter =>
            enter
              .transition(t)
              .attr('width', d => xScale(d.count) - xScale(0))
          )
      )

    // selection styling + click interaction
    bars
      .style('cursor', 'pointer')
      .attr('stroke', d => (d.genre === selectedGenre ? '#111' : 'none'))
      .attr('stroke-width', d => (d.genre === selectedGenre ? 2 : 0))
      .on('click', (event, d) => {
        const next = d.genre === selectedGenre ? null : d.genre
        onSelectGenre(next)
      })

    // selection styling + click + hover
    bars
      .style('cursor', 'pointer')
      .attr('stroke', d => (d.genre === selectedGenre ? '#111' : 'none'))
      .attr('stroke-width', d => (d.genre === selectedGenre ? 2 : 0))

      .on('click', (_event, d) => {
        const cur = selectedGenreRef.current
        const next = d.genre === cur ? null : d.genre
        onSelectGenre(next)
      })

      .on('mouseenter', function () {
        d3.select(this)
          .attr('opacity', 1)
          .attr('stroke', '#111')
          .attr('stroke-width', 2)
      })

      .on('mouseleave', function (_event, d) {
        const cur = selectedGenreRef.current
        const isSelected = d.genre === cur

        d3.select(this)
          .attr('opacity', 0.95)
          .attr('stroke', isSelected ? '#111' : 'none')
          .attr('stroke-width', isSelected ? 2 : 0)
      })


    // Value labels, slide with bar end
    const labelsG = svg.append('g').attr('class', 'bar-labels')

    labelsG
      .selectAll<SVGTextElement, BarDatum>('text')
      .data(data, (d: any) => d.genre)
      .join(enter =>
        enter
          .append('text')
          .attr('x', xScale(0) + 6) // start near left
          .attr('y', d => (yScale(d.genre) ?? 0) + yScale.bandwidth() / 2)
          .attr('dy', '0.35em')
          .style('font-size', '11px')
          .style('opacity', 0.85)
          .text(d => d3.format(',')(d.count))
          .call(enter =>
            enter
              .transition(t)
              .attr('x', d => xScale(d.count) + 6) // move to bar end
          )
      )

    // axes
    svg
      .append('g')
      .attr('transform', `translate(0, ${size.height - margin.bottom})`)
      .call(d3.axisBottom(xScale).ticks(5))

    svg
      .append('g')
      .attr('transform', `translate(${margin.left}, 0)`)
      .call(d3.axisLeft(yScale))
      .style('font-size', '0.7rem')
      .style('font-weight', 'Bold')


    const title = selectedYearBin === null
      ? 'Top 10 Genres (All Years: 1990–2025)'
      : `Top 10 Genres (Selected: ${selectedYearBin[0]}–${selectedYearBin[1]})`

    svg
      .append('text')
      .attr('x', margin.left)
      .attr('y', margin.top - 25)
      .style('font-weight', 'bold')
      .style('font-size', '1rem')
      .text(title)

    svg
      .append('text')
      .attr('x', (margin.left + (size.width - margin.right)) / 2)
      .attr('y', size.height - 10)
      .style('text-anchor', 'middle')
      .style('font-size', '.9rem')
      .text('Track Count')

    const hintX = size.width - margin.right + 10
    const hintY = size.height - 85

    const hint = svg
      .append('text')
      .attr('x', hintX)
      .attr('y', hintY)
      .style('text-anchor', 'end')
      .style('font-size', '12px')
      .style('opacity', 0.6)

    hint.append('tspan')
      .attr('x', hintX)
      .attr('dy', 0)
      .text('Click a bar to filter the line')

    hint.append('tspan')
      .attr('x', hintX)
      .attr('dy', 16)
      .text('chart and see duration')

    hint.append('tspan')
      .attr('x', hintX)
      .attr('dy', 16)
      .text('trends for that genre')
    }

  return (
    <div ref={containerRef} className="chart-container" style={{ position: 'relative', width: '100%', height: '100%' }}>
      <svg id="genre-bar-svg" width="100%" height="100%" />
    </div>
  )
}