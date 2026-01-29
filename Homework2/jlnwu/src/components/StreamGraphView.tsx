// Created a streamgraph to show the average track duration over years for selected top artists
// NOT USED IN HW2  

import React from 'react'
import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { isEmpty } from 'lodash'
import { useDebounceCallback, useResizeObserver } from 'usehooks-ts'

import { ComponentSize, Margin } from '../types'

type StreamGraphType = {
    artist: string
    year: number
    duration: number // minutes
}

type YearWide = {
   year: number
  [artist: string]: number
}

export default function StreamGraphView(){
    const [wide, setWide] = useState<YearWide[]>([])
    const [keys, setKeys] = useState<string[]>([])

    const containerRef = useRef<HTMLDivElement>(null)
    const [size, setSize] = useState<ComponentSize>({ width: 0, height: 0 })
    const margin: Margin = { top: 50, right: 160, bottom: 60, left: 70 }
    const onResize = useDebounceCallback((s: ComponentSize) => setSize(s), 200)
    
    useResizeObserver({ ref: containerRef as React.RefObject<HTMLDivElement>, onResize })

    useEffect(() => {
        const dataFromCSV = async () => {
            try{
                const manual_artists = [
                    'Taylor Swift',
                    'Drake',
                    'The Weeknd',
                    'Ariana Grande',
                ]

                const YEAR_MIN = 2009
                const YEAR_MAX = 2025

                const rows = await d3.csv('../../data/spotify_data clean.csv', (d) => {
                    const artist = (d.artist_name ?? '').trim()
                    const followers = Number(d.artist_followers)
                    const duration = Number(d.track_duration_min)
                    const release = String(d.album_release_date ?? '').trim()
                    const year = parseYear(release)

                    return { artist, followers, duration, year }
                })
                const clean: StreamGraphType[] = rows
                    .filter((r) => r.artist && Number.isFinite(r.duration) && Number.isFinite(r.year))
                    .map((r) => r as unknown as StreamGraphType)
                    .filter((r) => manual_artists.includes(r.artist))
                    .filter((r) => r.year >= YEAR_MIN && r.year <= YEAR_MAX)

                const allYears = d3.range(YEAR_MIN, YEAR_MAX + 1)

                const byArtistYear = d3.rollups(
                    clean,
                    (v) => ({
                        sum: d3.sum(v, (d) => d.duration),
                        count: v.length,
                    }),
                    (d) => d.artist,
                    (d) => d.year
                )

                const yearToObj = new Map<number, YearWide>()

                for (const y of allYears) yearToObj.set(y, { year: y })

                for (const [artist, yearPairs] of byArtistYear) {
                    for (const [year, agg] of yearPairs) {
                        const obj = yearToObj.get(year)
                        if (!obj) continue
                        obj[artist] = agg.count > 0 ? agg.sum / agg.count : 0
                    }
                }

                const wideData = Array.from(yearToObj.values()).map((d) => {
                    const out: YearWide = { year: d.year }
                    for (const a of manual_artists) out[a] = Number.isFinite(d[a]) ? (d[a] as number) : 0
                    return out
                })

                console.log('clean rows:', clean.length)
                console.log('wideData sample:', wideData.slice(0, 3))

                setKeys(manual_artists)
                setWide(wideData)
            }
            catch (error) {
                console.error('Error loading CSV', error)
            }
        }
        dataFromCSV()
    }, [])

    useEffect(() => {
        if (isEmpty(wide) || isEmpty(keys) || size.width === 0 || size.height === 0) return

        // Clear previous svg content if any
        d3.select('#stream-svg').selectAll('*').remove()
        initchart()
    }, [wide, keys, size] )

    function initchart(){
        const chartContainer = d3.select('#stream-svg')

        const stack = d3
            .stack<YearWide>()
            .keys(keys)
            .order(d3.stackOrderNone)
            .offset(d3.stackOffsetNone)

        const layers = stack(wide)

        const xScale = d3
            .scaleLinear()
            .domain([2009, 2025])
            .range([margin.left, size.width - margin.right])

        const yMin = d3.min(layers, (layer) => d3.min(layer, (d) => d[0])) ?? 0
        const yMax = d3.max(layers, (layer) => d3.max(layer, (d) => d[1])) ?? 1

        const yScale = d3
            .scaleLinear()
            .domain([yMin, yMax])
            .range([size.height - margin.bottom, margin.top])

        const color = d3.scaleOrdinal<string, string>(d3.schemeTableau10).domain(keys)

        const area = d3
            .area<d3.SeriesPoint<YearWide>>()
            .x((d) => xScale(d.data.year))
            .y0((d) => yScale(d[0]))
            .y1((d) => yScale(d[1]))
            .curve(d3.curveCatmullRom)

        const drawLayers = chartContainer
            .append('g')
            .selectAll('path')
            .data(layers)
            .join('path')
            .attr('d', area as any)
            .attr('fill', (d) => color(d.key))
            .attr('opacity', 0.9)
        
        const xAxis = chartContainer
            .append('g')
            .attr('transform', `translate(0, ${size.height - margin.bottom})`)
            .call(d3.axisBottom(xScale).ticks(9).tickFormat(d3.format('d')))

        const yAxis = chartContainer
            .append('g')
            .attr('transform', `translate(${margin.left}, 0)`)
            .call(d3.axisLeft(yScale).ticks(5))

        const xLabel = chartContainer
            .append('text')
            .attr('x', size.width / 2)
            .attr('y', size.height - 12)
            .style('text-anchor', 'middle')
            .style('font-size', '.9rem')
            .text('Release Year (2009–2025)')

        const yLabel = chartContainer
            .append('text')
            .attr('transform', 'rotate(-90)')
            .attr('x', -(size.height / 2))
            .attr('y', 18)
            .style('text-anchor', 'middle')
            .style('font-size', '.9rem')
            .text('Stacked Avg Track Duration (min)')
        
        const title = chartContainer
            .append('text')
            .attr('x', size.width / 2)
            .attr('y', margin.top / 2)
            .style('text-anchor', 'middle')
            .style('font-weight', 'bold')
            .style('font-size', '1rem')
            .text('Streamgraph (Avg Track Duration) for Selected Top Artists')
        
        const legendX = size.width - margin.right + 12
        const legendY = size.height - margin.bottom - 20 - keys.length * 16

        const legend = chartContainer.
            append('g')
            .attr('transform', `translate(${legendX},${legendY})`)

        const legendItems = legend
            .append('text')
            .attr('x', 0)
            .attr('y', -8)
            .style('font-size', '.8rem')
            .style('font-weight', 'bold')
            .text('Artists')

        keys.forEach((k, i) => {
            const y0 = i * 16
            legend.append('rect').attr('x', 0).attr('y', y0).attr('width', 12).attr('height', 12).attr('fill', color(k))
            legend
                .append('text')
                .attr('x', 18)
                .attr('y', y0 + 10)
                .style('font-size', '.8rem')
                .text(k)
        })
        
    }
    return (
        <div ref={containerRef} className="chart-container">
        <svg id="stream-svg" width="100%" height="100%"></svg>
        </div>
    )
}

function parseYear(s: string): number {
  if (!s) return NaN
  const m = s.match(/^(\d{4})/)
  return m ? Number(m[1]) : NaN
}