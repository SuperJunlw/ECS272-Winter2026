//Create a more focused view that can shows multiple metrics of 
// popular artists (with at least 80 popularity) using parallel coordinates
// Each line represents an artist, and each vertical axis represents a metric

import React from 'react'
import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { isEmpty } from 'lodash'
import { useDebounceCallback, useResizeObserver } from 'usehooks-ts'

import { ComponentSize, Margin } from '../types'

// Define the data type for parallel coordinates
type ParallelCoordType = {
    artist: string
    artist_popularity: number
    artist_followers: number
    avg_track_popularity: number
    track_count: number
    avg_track_duration: number // minutes
    explicit_rate: number // 0..1
    genre: string
}

export default function ParallelCoordsView() {
    const [data, setData] = useState<ParallelCoordType[]>([]) // State to store processed data
    const containerRef = useRef<HTMLDivElement>(null) // Reference to the div container
    const [size, setSize] = useState<ComponentSize>({ width: 0, height: 0 }) // State to store container size
    const margin: Margin = { top: 50, right: 20, bottom: 60, left: 75 }
    const onResize = useDebounceCallback((size: ComponentSize) => setSize(size), 200) // Debounce to avoid too many re-renders

    // Observe changes in container size
    useResizeObserver({ ref: containerRef as React.RefObject<HTMLDivElement>, onResize });

    // Load and process data from CSV file
    useEffect(() => {
        // For reading csv file
        const dataFromCSV = async () => {
            try {
                // Load CSV data and process variables we need for each row
                const rows = await d3.csv('../../data/spotify_data clean.csv', d => {
                    const artist = (d.artist_name ?? '').trim()
                    const artist_popularity = Number(d.artist_popularity)
                    const track_popularity = Number(d.track_popularity)
                    const artist_followers = Number(d.artist_followers)
                    const track_duration = Number(d.track_duration_min)
                    const expUpper = String(d.explicit ?? '').toLowerCase().trim()
                    const explicit = expUpper === 'true'
                    const genre = String(d.artist_genres ?? '').trim()

                    return { artist, artist_popularity, track_popularity, artist_followers, track_duration, explicit, genre }
                })

                //Map to aggregate data per artist
                const artistMap = new Map<
                    string, 
                    {
                        artist_pop: number
                        followers: number
                        sum_track_pop: number 
                        count: number 
                        sum_duration: number 
                        explicit_count: number
                        genre: string
                    }>()

                // Aggregate data for each artist
                for (const row of rows) {
                    // Make sure data is valid
                    if (!row.artist) continue
                    if (!Number.isFinite(row.artist_popularity)) continue
                    if (!Number.isFinite(row.track_popularity)) continue
                    if (!Number.isFinite(row.artist_followers)) continue
                    if (!Number.isFinite(row.track_duration)) continue

                    // Get previous aggregation for the artist
                    const prev = artistMap.get(row.artist)

                    //See a new artist entry, add it to the map
                    if (!prev) {
                        artistMap.set(row.artist, {
                            artist_pop: row.artist_popularity,
                            followers: row.artist_followers,
                            sum_track_pop: row.track_popularity,
                            count: 1,
                            sum_duration: row.track_duration,
                            explicit_count: row.explicit ? 1 : 0,
                            genre: row.genre || 'Unknown',
                        })
                    }
                    //Update existing artist aggregation
                    else {
                        prev.artist_pop = Math.max(prev.artist_pop, row.artist_popularity)
                        prev.followers = Math.max(prev.followers, row.artist_followers)
                        prev.sum_track_pop += row.track_popularity
                        prev.count += 1
                        prev.sum_duration += row.track_duration
                        prev.explicit_count += row.explicit ? 1 : 0
                        if (prev.genre === 'Unknown' && row.genre) prev.genre = row.genre
                    }
                }

                //Convert the map to an array of ParallelCoordType objects
                const artists: ParallelCoordType[] = Array.from(artistMap.entries()).map(([artist, a]) => ({
                    artist,
                    artist_popularity: a.artist_pop,
                    artist_followers: a.followers,
                    avg_track_popularity: a.sum_track_pop / a.count,
                    track_count: a.count,
                    avg_track_duration: (a.sum_duration / a.count),
                    explicit_rate: a.explicit_count / a.count,
                    genre: a.genre || 'Unknown',
                }))

                //Threshold to filter popular artists
                const POP_THRESHOLD = 80
                const filtered = artists.filter((d) => d.artist_popularity >= POP_THRESHOLD)

                setData(filtered)
            } catch (error) {
                console.error('Error loading CSV:', error)
            }
        }
        dataFromCSV()
    }, [])

    // Re-render the chart when data or size changes
    useEffect(() => {
        if (isEmpty(data)) return
        if (size.width === 0 || size.height === 0) return

        // Clear previous chart before re-draw
        d3.select('#parallel-svg').selectAll('*').remove()
        initChart()
    }, [data, size])

    // Initialize and draw the parallel coordinates chart
    function initChart() {

        // Select the svg tag so that we can insert elements within it
        const chartContainer = d3.select('#parallel-svg')

        // Define the dimensions/metrics to be shown
        const dimensions: Array<keyof ParallelCoordType> = [
            'artist_popularity',
            'avg_track_popularity',
            'artist_followers',
            'track_count',
            'avg_track_duration',
            'explicit_rate',
        ]

        // Labels for each dimension
        const dimensionsLabels: Record<string, string> = {
            artist_popularity: 'Artist Popularity',
            avg_track_popularity: 'Avg Track Popularity',
            artist_followers: 'Followers',
            track_count: 'Track Count',
            avg_track_duration: 'Average Duration (min)',
            explicit_rate: 'Explicit Rate',
        }

        // X positions of vertical axes
        const xScale = d3
            .scalePoint<string>()
            .domain(dimensions as unknown as string[])
            .range([margin.left, size.width - margin.right])
            .padding(0.25)

        // One Y scale per dimension (followers uses log scale)
        const yScales: Record<string, any> = {}

        // Create Y scales for each dimension
        for (const dim of dimensions as unknown as string[]) {
            // explicit rate is between 0 and 1
            if (dim === 'explicit_rate') {
                yScales[dim] = d3
                .scaleLinear()
                .domain([0, 1])
                .range([size.height - margin.bottom, margin.top])
            } 
            // artist followers uses log scale due to wide range
            else if (dim === 'artist_followers') {
                const ext = d3.extent(data, (d) => d.artist_followers) as [number, number]
                const minVal = Math.max(1, ext[0] ?? 1)
                const maxVal = Math.max(minVal + 1, ext[1] ?? minVal + 1)

                yScales[dim] = d3
                .scaleLog()
                .domain([minVal, maxVal])
                .range([size.height - margin.bottom, margin.top])
            } 
            // // Fixed scale for track count: always 0 → 200
            // else if (dim === 'track_count') {
            //     yScales[dim] = d3
            //     .scaleLinear()
            //     .domain([0, 200])
            //     .range([size.height - margin.bottom, margin.top])
            // }
            // Other dimensions use linear scale
            else {
                const values = data.map((d) => Number((d as any)[dim]))
                const ext = d3.extent(values) as [number, number]

                yScales[dim] = d3
                    .scaleLinear()
                    .domain([ext[0] ?? 0, ext[1] ?? 1])
                    .range([size.height - margin.bottom, margin.top])
            }
        }

        // Line generator to draw polylines for each artist
        const line = d3.line<[number, number]>()

        // Get the points for each artist's polyline
        // Each artist has a sequence of (x,y) points, one per dimension
        function pathFor(d: ParallelCoordType): [number, number][] {
            return (dimensions as unknown as string[]).map((dim) => {
                const x = xScale(dim) as number
                const y = yScales[dim](Number((d as any)[dim]))
                return [x, y]
            })
        }

        // Draw lines
        const ployLines = chartContainer
            .append('g')
            .selectAll('path')
            .data(data)
            .join('path')
            .attr('d', (d) => line(pathFor(d))!)
            .attr('fill', 'none')
            .attr('stroke', 'teal')
            .attr('stroke-width', 1)
            .attr('opacity', 0.18)

        // Draw axes
        for (const dim of dimensions as unknown as string[]) {
        const x = xScale(dim) as number

            let axis
            if (dim === 'artist_followers') {
                axis = d3.axisLeft(yScales[dim]).ticks(4, '~s')
            } else if (dim === 'explicit_rate') {
                axis = d3.axisLeft(yScales[dim]).ticks(4, '.0%')
            } else {
                axis = d3.axisLeft(yScales[dim]).ticks(4)
            }

            chartContainer
                .append('g')
                .attr('transform', `translate(${x},0)`)
                .call(axis)

            chartContainer
                .append('text')
                .attr('x', x)
                .attr('y', size.height - 20)
                .style('text-anchor', 'middle')
                .style('font-size', '.75rem')
                .text(dimensionsLabels[dim])
        }

        // Title
        chartContainer
            .append('text')
            .attr('x', size.width / 2)
            .attr('y', margin.top / 2)
            .style('text-anchor', 'middle')
            .style('font-weight', 'bold')
            .style('font-size', '1rem')
            .text('Parallel Coordinates (Popularity ≥ 80) metrics for Artist')
    }
    return (
        <div ref={containerRef} className='chart-container'>
            <svg id='parallel-svg' width='100%' height='100%'></svg>
        </div>
    )
}